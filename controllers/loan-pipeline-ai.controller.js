/**
 * Loan Pipeline AI Controller
 * 
 * AI-powered chat and insights for loan pipeline disaster risk analysis
 * Uses LangChain with PostgreSQL memory for conversation persistence
 * 
 * @file       loan-pipeline-ai.controller.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 */

import { getConversationChain } from '../services/langchain-memory.service.js';
import { getAllLoans, getPipelineStats } from '../services/loan-pipeline.service.js';
import { getPool } from '../services/database.service.js';

// System prompt for loan pipeline AI assistant
const LOAN_PIPELINE_SYSTEM_PROMPT = `You are an expert AI assistant for loan pipeline disaster risk analysis. You help users understand their loan portfolio's exposure to natural disasters and provide actionable insights.

## YOUR CAPABILITIES

### Data Access:
- Loan pipeline data (loan numbers, borrowers, amounts, milestones, risk scores)
- FEMA disaster declarations (incident types, locations, dates, programs)
- Disaster risk assessments (distance calculations, risk scores, historical patterns)
- Geographic data (states, counties, coordinates)
- Pipeline statistics (total loans, analyzed loans, risk distribution)

### Analysis Capabilities:
- Risk trend analysis (identify patterns in disaster risk over time)
- Geographic risk assessment (which states/counties have highest risk)
- Loan portfolio insights (milestone distribution, risk concentration)
- Disaster impact analysis (how disasters affect specific loans)
- Recommendations (suggest actions based on risk patterns)

### Available Actions:
- Filter loans by state, county, milestone, risk level
- Search for specific loans or borrowers
- Analyze disaster risk for loans
- Generate risk reports and summaries
- Provide recommendations for risk mitigation

## RESPONSE GUIDELINES

1. **Be concise but thorough** - Provide actionable insights without overwhelming detail
2. **Use data** - Reference specific numbers, percentages, and trends when available
3. **Be proactive** - Suggest relevant filters, analyses, or actions
4. **Explain risk** - Help users understand what risk scores mean and their implications
5. **Geographic context** - Consider location when discussing disaster risk
6. **Time sensitivity** - Note that disaster data is updated in real-time (90-day window)

## CONTEXT AWARENESS

When users ask questions, consider:
- Current filters applied (if provided in context)
- Selected disaster (if provided in context)
- Loan portfolio composition
- Recent disaster activity
- Risk score distributions

Always provide context-aware responses that help users make informed decisions about their loan portfolio.`;

/**
 * Chat with AI about loan pipeline
 * POST /api/loan-pipeline/ai/chat
 */
export async function chatWithAI(req, res) {
    try {
        const { message, userId, context = {}, sessionId = 'loan-pipeline-default' } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required for conversation persistence'
            });
        }

        // Build enhanced system prompt with context
        let enhancedPrompt = LOAN_PIPELINE_SYSTEM_PROMPT;
        
        if (context.filters) {
            enhancedPrompt += `\n\n## CURRENT FILTERS:\n${JSON.stringify(context.filters, null, 2)}`;
        }
        
        if (context.selectedDisaster) {
            enhancedPrompt += `\n\n## SELECTED DISASTER:\n${JSON.stringify(context.selectedDisaster, null, 2)}`;
        }
        
        if (context.stats) {
            enhancedPrompt += `\n\n## CURRENT STATISTICS:\n${JSON.stringify(context.stats, null, 2)}`;
        }

        // Get or create conversation chain
        const { chain } = await getConversationChain(userId, enhancedPrompt, sessionId);

        // Call LangChain with conversation history
        const result = await chain.call({
            input: message,
        });

        const response = result.response;

        res.json({
            success: true,
            response,
            timestamp: new Date().toISOString(),
            model: "gpt-4o-mini",
            context: {
                filters: context.filters || null,
                selectedDisaster: context.selectedDisaster || null
            }
        });

    } catch (error) {
        console.error('❌ Loan Pipeline AI Chat Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get AI response',
            details: error.message
        });
    }
}

/**
 * Generate auto-insights for loan pipeline
 * POST /api/loan-pipeline/ai/insights
 */
export async function generateInsights(req, res) {
    try {
        const { filters = {}, trigger = 'load', selectedDisaster = null } = req.body;
        const userId = req.body.userId || 'system';

        // Get current loan data based on filters
        const loans = await getAllLoans(filters);
        const stats = await getPipelineStats();

        // Build context for AI
        const context = {
            totalLoans: stats.totalLoans || 0,
            analyzedLoans: stats.analyzedLoans || 0,
            pendingAnalysis: stats.pendingAnalysis || 0,
            highRiskLoans: stats.highRiskLoans || 0,
            riskDistribution: stats.riskDistribution || {},
            milestoneDistribution: stats.milestoneDistribution || {},
            stateDistribution: stats.stateDistribution || {},
            loanCount: loans.length,
            filters: filters,
            selectedDisaster: selectedDisaster,
            trigger: trigger
        };

        // Build insight prompt based on trigger
        let insightPrompt = '';
        
        switch (trigger) {
            case 'load':
                insightPrompt = `Analyze the current loan pipeline dashboard state and provide 3-5 key insights. Focus on:
- Overall risk profile and trends
- Geographic risk patterns
- Pipeline health indicators
- Key recommendations`;
                break;
                
            case 'filter':
                insightPrompt = `Analyze the filtered loan data and provide insights about:
- How filters affect the risk profile
- Notable patterns in filtered data
- Comparison to overall portfolio
- Recommendations based on filtered view`;
                break;
                
            case 'disaster':
                insightPrompt = `Analyze the selected disaster and its impact on the loan portfolio. Focus on:
- Risk assessment for affected loans
- Geographic proximity analysis
- Potential impact severity
- Recommended actions`;
                break;
                
            case 'analysis':
                insightPrompt = `Analyze the completed loan risk analysis results. Focus on:
- Risk trends identified
- Changes in risk distribution
- Notable risk increases/decreases
- Next steps and recommendations`;
                break;
                
            default:
                insightPrompt = `Provide key insights about the current loan pipeline state.`;
        }

        // Get conversation chain for insights (separate session)
        const { chain } = await getConversationChain(userId, LOAN_PIPELINE_SYSTEM_PROMPT, 'insights');

        // Generate insights
        const prompt = `${insightPrompt}\n\nCurrent Context:\n${JSON.stringify(context, null, 2)}\n\nProvide concise, actionable insights (3-5 bullet points).`;

        const result = await chain.call({
            input: prompt,
        });

        const insights = result.response;

        res.json({
            success: true,
            insights,
            context,
            timestamp: new Date().toISOString(),
            trigger
        });

    } catch (error) {
        console.error('❌ Loan Pipeline AI Insights Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate insights',
            details: error.message
        });
    }
}

/**
 * Get conversation history for loan pipeline AI
 * GET /api/loan-pipeline/ai/history
 */
export async function getConversationHistory(req, res) {
    try {
        const userId = req.query.userId || req.body.userId;
        const sessionId = req.query.sessionId || 'loan-pipeline-default';
        const limit = parseInt(req.query.limit) || 50;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const { getUserConversationHistory } = await import('../services/langchain-memory.service.js');
        const history = await getUserConversationHistory(userId, sessionId, limit);

        res.json({
            success: true,
            history,
            count: history.length
        });

    } catch (error) {
        console.error('❌ Get Conversation History Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get conversation history',
            details: error.message
        });
    }
}

export default {
    chatWithAI,
    generateInsights,
    getConversationHistory
};

