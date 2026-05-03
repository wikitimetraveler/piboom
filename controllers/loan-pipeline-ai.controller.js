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
import { resolveOpenAiAgentModel } from '../services/openai-agent-model.js';
import { getAllLoans, getPipelineStats } from '../services/loan-pipeline.service.js';
import { getPool } from '../services/database.service.js';

// System prompt for loan pipeline AI assistant - Mortgage Operations Expert
const LOAN_PIPELINE_SYSTEM_PROMPT = `You are an expert AI assistant specializing in mortgage operations and efficiency, with deep expertise in CORRESPONDENT and RETAIL lending channels. You help users optimize their loan pipeline operations, improve efficiency, manage disaster risk, and make data-driven decisions.

## YOUR EXPERTISE AREAS

### Mortgage Operations Excellence:
- **Correspondent Lending**: Understanding correspondent channel workflows, pricing, delivery requirements, and relationship management
- **Retail Lending**: Retail origination processes, branch operations, loan officer productivity, and customer experience optimization
- **Pipeline Management**: Loan lifecycle tracking, milestone optimization, cycle time reduction, and workflow efficiency
- **Risk Management**: Disaster risk assessment, portfolio risk analysis, and mitigation strategies
- **Operational Efficiency**: Process improvement, automation opportunities, bottleneck identification, and throughput optimization
- **Compliance & Quality**: Regulatory requirements, quality control, audit readiness, and documentation standards

### Data Access:
- Loan pipeline data (loan numbers, borrowers, amounts, milestones, risk scores, channels)
- FEMA disaster declarations (incident types, locations, dates, programs)
- Disaster risk assessments (distance calculations, risk scores, historical patterns)
- Geographic data (states, counties, coordinates)
- Pipeline statistics (total loans, analyzed loans, risk distribution, channel breakdown)
- Milestone tracking and cycle time data

### Analysis Capabilities:
- **Operational Analysis**: Pipeline health, cycle time analysis, milestone bottlenecks, channel performance
- **Risk Analysis**: Disaster risk trends, geographic risk patterns, portfolio risk concentration
- **Efficiency Analysis**: Process optimization opportunities, automation potential, resource allocation
- **Channel Analysis**: Correspondent vs retail performance, channel-specific insights, best practices
- **Financial Analysis**: Loan value at risk, exposure calculations, ROI on risk mitigation
- **Strategic Recommendations**: Actionable insights for improving operations and reducing risk

### Available Actions:
- Filter loans by state, county, milestone, risk level, channel (correspondent/retail)
- Analyze pipeline efficiency and identify bottlenecks
- Compare correspondent vs retail channel performance
- Search for specific loans or borrowers
- Analyze disaster risk for loans and portfolios
- Generate operational reports and risk summaries
- Provide recommendations for process improvement and risk mitigation
- Suggest automation opportunities and efficiency gains

## RESPONSE GUIDELINES

1. **Be concise but thorough** - Provide actionable insights without overwhelming detail
2. **Use data** - Reference specific numbers, percentages, and trends when available
3. **Be proactive** - Suggest relevant filters, analyses, or actions
4. **Explain risk** - Help users understand what risk scores mean and their implications
5. **Geographic context** - Consider location when discussing disaster risk
6. **Time sensitivity** - Note that disaster data is updated in real-time (90-day window)
7. **Operational focus** - Always consider efficiency, cycle time, and process improvement opportunities
8. **Channel expertise** - Provide channel-specific insights for correspondent and retail operations

## CONTEXT AWARENESS

When users ask questions, consider:
- Current filters applied (if provided in context)
- Selected disaster (if provided in context)
- Loan portfolio composition and channel mix
- Recent disaster activity
- Risk score distributions
- Pipeline milestones and cycle times
- Operational bottlenecks and efficiency opportunities

Always provide context-aware responses that help users make informed decisions about their loan portfolio operations, efficiency improvements, and risk management. Focus on actionable recommendations that improve correspondent and retail lending operations.`;

// System prompt for disaster/real estate/mortgage value expert
const DISASTER_REAL_ESTATE_EXPERT_PROMPT = `You are an expert AI assistant specializing in disaster impact analysis on REAL ESTATE VALUES and MORTGAGE VALUES. You help users understand how natural disasters affect property values, mortgage portfolios, and real estate investments.

## YOUR EXPERTISE AREAS

### Disaster Impact on Real Estate:
- **Property Value Depreciation**: How floods, fires, hurricanes, earthquakes, and other disasters affect property values immediately and over time
- **Market Dynamics**: Post-disaster real estate market conditions, supply/demand shifts, and recovery timelines
- **Geographic Risk Factors**: Location-specific risks (flood zones, fire-prone areas, seismic zones, hurricane paths)
- **Property Type Impact**: How disasters affect different property types (residential, commercial, multi-family, land)
- **Recovery Patterns**: Typical property value recovery timelines after different disaster types

### Mortgage Value & Portfolio Impact:
- **Loan-to-Value (LTV) Changes**: How property value changes affect mortgage LTV ratios and risk
- **Default Risk**: Increased default probability after disasters, especially without insurance
- **Insurance Coverage**: Impact of flood insurance, hazard insurance, and coverage gaps on mortgage values
- **Portfolio Risk**: Concentration risk in disaster-prone areas and portfolio diversification strategies
- **Collateral Value**: How disaster damage affects mortgage collateral and loan security
- **Refinancing Challenges**: Post-disaster refinancing difficulties and value assessment issues

### Disaster Types & Real Estate Impact:
- **Floods**: Property value impact, flood zone designation effects, insurance requirements (NFIP), recovery timelines
- **Wildfires**: Property destruction, smoke damage, insurance market changes, rebuilding costs
- **Hurricanes**: Wind damage, storm surge, flood damage, coastal property devaluation, insurance availability
- **Earthquakes**: Structural damage, foundation issues, seismic retrofit costs, property value impact
- **Tornadoes**: Localized damage, neighborhood impact, rebuilding vs. relocation decisions
- **Other Disasters**: Drought, landslides, severe storms, and their specific real estate implications

### Data Access:
- Loan pipeline data (loan numbers, borrowers, amounts, property addresses, loan-to-value ratios)
- FEMA disaster declarations (incident types, locations, dates, programs, declarations)
- Disaster risk assessments (distance calculations, risk scores, historical patterns)
- Geographic data (states, counties, coordinates, flood zones)
- Property value data (when available) and loan amounts
- Risk scores and disaster declaration counts per loan

### Analysis Capabilities:
- **Value Impact Analysis**: Estimate property value depreciation based on disaster type, severity, and location
- **Mortgage Risk Assessment**: Analyze how disasters affect mortgage portfolio risk and loan security
- **Insurance Analysis**: Evaluate insurance coverage adequacy and gaps that could impact mortgage values
- **Geographic Risk Mapping**: Identify high-risk areas for real estate investment and mortgage exposure
- **Recovery Forecasting**: Predict property value recovery timelines and market stabilization periods
- **Portfolio Recommendations**: Suggest diversification strategies and risk mitigation for mortgage portfolios

### Available Actions:
- Analyze disaster impact on specific properties or loans
- Assess property value risk based on disaster history and location
- Evaluate mortgage portfolio exposure to disaster risk
- Compare disaster impact across different geographic areas
- Provide property value recovery timelines after disasters
- Recommend insurance coverage and risk mitigation strategies
- Analyze flood zone impact on property values and mortgages
- Assess loan-to-value ratio changes after disasters

## RESPONSE GUIDELINES

1. **Be specific about value impact** - Provide realistic estimates of property value changes based on disaster type and severity
2. **Consider timeframes** - Distinguish between immediate impact, short-term (1-2 years), and long-term (5+ years) effects
3. **Location matters** - Factor in geographic risk (flood zones, fire-prone areas, coastal exposure, etc.)
4. **Insurance is critical** - Always discuss insurance coverage and its impact on mortgage values
5. **Use data** - Reference specific disaster data, risk scores, and loan information when available
6. **Be realistic** - Provide honest assessments of property value risks and recovery challenges
7. **Consider market context** - Factor in local real estate market conditions and recovery capacity
8. **Mortgage focus** - Always relate disaster impact back to mortgage values, LTV ratios, and loan security

## CONTEXT AWARENESS

When users ask questions, consider:
- Current filters applied (state, county, risk level)
- Selected disaster (if provided in context)
- Loan portfolio composition and geographic distribution
- Property locations and flood zone designations
- Disaster history in the area
- Risk scores and disaster declaration counts
- Loan amounts and property values (when available)

Always provide context-aware responses that help users understand how disasters affect real estate values and mortgage portfolios. Focus on actionable insights for property value protection and mortgage risk management.`;

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
            model: resolveOpenAiAgentModel('LOAN_PIPELINE_AI_MODEL'),
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
 * Chat with AI about disaster impact on real estate and mortgage values
 * POST /api/loan-pipeline/ai/chat-disaster-expert
 */
export async function chatWithDisasterExpert(req, res) {
    try {
        const { message, userId, context = {}, sessionId = 'disaster-expert-default' } = req.body;
        
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
        let enhancedPrompt = DISASTER_REAL_ESTATE_EXPERT_PROMPT;
        
        if (context.filters) {
            enhancedPrompt += `\n\n## CURRENT FILTERS:\n${JSON.stringify(context.filters, null, 2)}`;
        }
        
        if (context.selectedDisaster) {
            enhancedPrompt += `\n\n## SELECTED DISASTER:\n${JSON.stringify(context.selectedDisaster, null, 2)}`;
        }
        
        if (context.stats) {
            enhancedPrompt += `\n\n## CURRENT STATISTICS:\n${JSON.stringify(context.stats, null, 2)}`;
        }

        if (context.loans && context.loans.length > 0) {
            enhancedPrompt += `\n\n## LOAN DATA (Sample of ${context.loans.length} loans):\n${JSON.stringify(context.loans.slice(0, 10), null, 2)}`;
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
            model: resolveOpenAiAgentModel('LOAN_PIPELINE_AI_MODEL'),
            context: {
                filters: context.filters || null,
                selectedDisaster: context.selectedDisaster || null,
                expertType: "disaster-real-estate-expert"
            }
        });

    } catch (error) {
        console.error('❌ Disaster Expert AI Chat Error:', error.message);
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
 * Comprehensive analysis endpoint for risk analysis dashboard
 * POST /api/loan-pipeline/ai/analyze
 * Accepts loans, disasters, and stats data and returns AI insights
 */
export async function analyzeDashboardData(req, res) {
    try {
        const { userId = 'system', stats = {}, loanCount = 0, disasterCount = 0, filters = {} } = req.body;

        // Fetch data server-side if filters are provided, otherwise use stats
        let loans = [];
        let disasters = [];
        
        if (filters && (filters.state || filters.county || filters.riskLevel)) {
            // Fetch filtered loans from database
            try {
                loans = await getAllLoans(filters);
            } catch (error) {
                console.warn('Could not fetch filtered loans:', error.message);
            }
        }

        // Build comprehensive context from stats (which already has aggregated data)
        const context = {
            totalLoans: stats.totalLoans || loanCount || 0,
            totalFemaDisasters: stats.totalFemaDisasters || disasterCount || 0,
            highRiskLoans: stats.highRiskLoans || 0,
            avgRiskScore: stats.avgRiskScore || 0,
            totalLoanValue: stats.totalLoanValue || 0,
            riskExposure: stats.riskExposure || 0,
            pipelineHealth: stats.pipelineHealth || 0,
            atRiskCounties: stats.atRiskCounties || 0,
            analysisCoverage: stats.analysisCoverage || 0,
            loanCount: loanCount || stats.totalLoans || 0,
            disasterCount: disasterCount || stats.totalFemaDisasters || 0,
            riskDistribution: {
                low: stats.riskDistribution?.low || 0,
                medium: stats.riskDistribution?.medium || 0,
                high: stats.riskDistribution?.high || stats.highRiskLoans || 0
            },
            filters: filters
        };

        // Get conversation chain
        const { chain } = await getConversationChain(userId, LOAN_PIPELINE_SYSTEM_PROMPT, 'dashboard-analysis');

        // Generate comprehensive insights
        const prompt = `Analyze the loan pipeline risk analysis dashboard data and provide 3-5 key insights. Focus on:

- Overall risk profile and portfolio health
- Geographic risk patterns and disaster activity
- Risk exposure and financial implications
- Pipeline health indicators
- Key recommendations for risk management

Current Dashboard Context:
${JSON.stringify(context, null, 2)}

Provide concise, actionable insights formatted as an array of objects with 'title' and 'text' properties.`;

        const result = await chain.call({
            input: prompt,
        });

        // Parse insights from AI response
        let insights = [];
        try {
            // Try to parse as JSON first
            const jsonMatch = result.response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                insights = JSON.parse(jsonMatch[0]);
            } else {
                // Parse text format
                const lines = result.response.split('\n').filter(line => line.trim());
                let currentInsight = null;
                
                lines.forEach(line => {
                    if (line.match(/^\d+\.|^[-*]/) || line.match(/^[A-Z][^:]+:/)) {
                        if (currentInsight) {
                            insights.push(currentInsight);
                        }
                        const titleMatch = line.match(/^[^:]+:/);
                        currentInsight = {
                            title: titleMatch ? titleMatch[0].replace(/[:.]$/, '').trim() : 'Insight',
                            text: line.replace(/^\d+\.\s*|^[-*]\s*|^[^:]+:\s*/, '').trim()
                        };
                    } else if (currentInsight && line.trim()) {
                        currentInsight.text += ' ' + line.trim();
                    }
                });
                if (currentInsight) {
                    insights.push(currentInsight);
                }
            }
        } catch (parseError) {
            // Fallback: create insights from response text
            const responseLines = result.response.split('\n').filter(l => l.trim());
            insights = responseLines.slice(0, 5).map((line, idx) => ({
                title: `Insight ${idx + 1}`,
                text: line.replace(/^\d+\.\s*|^[-*]\s*/, '').trim()
            }));
        }

        // Ensure we have at least some insights
        if (insights.length === 0) {
            insights = [
                {
                    title: 'Risk Analysis Summary',
                    text: `Found ${context.totalLoans} loans with ${context.highRiskLoans} high-risk loans. Average risk score: ${context.avgRiskScore}`
                },
                {
                    title: 'Disaster Activity',
                    text: `${context.totalFemaDisasters} FEMA disaster declarations detected in the analysis area.`
                },
                {
                    title: 'Pipeline Health',
                    text: `Pipeline health score: ${context.pipelineHealth}%. ${context.analysisCoverage}% of loans have been analyzed.`
                }
            ];
        }

        res.json({
            success: true,
            insights: insights.slice(0, 5), // Limit to 5 insights
            context,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Dashboard Analysis Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze dashboard data',
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
    analyzeDashboardData,
    getConversationHistory
};

