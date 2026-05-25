/**
 * Development work by David Lane
 */
import express from 'express';
import encompassDocsService from '../services/encompass-docs.service.js';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import iceKnowledgeService from '../lib/knowledge/ice-knowledge.service.js';

const router = express.Router();

// Initialize OpenAI
const openai = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY?.trim(),
  modelName: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4000
});

// System prompt for Encompass AI Assistant
const ENCOMPASS_SYSTEM_PROMPT = `You are an expert AI assistant for Encompass Developer Connect documentation. You help developers understand and use the ICE Mortgage Technology Encompass Lending Platform APIs.

## 📚 DATA SOURCES & COLLECTIONS AVAILABLE

### Primary Documentation Sources:
- **Encompass Developer Connect** - Official API documentation
- **Postman Collections** - Ready-to-use API examples and environments
- **Knowledge Articles** - Community-driven solutions and best practices
- **API Reference Guides** - Complete endpoint documentation
- **Use Case Matrix** - Real-world implementation scenarios

### Available Collections & Resources:
- **Authentication Collection** - OAuth 2.0, API Keys, User Management
- **Loan Manufacturing Collection** - Complete loan lifecycle workflows
- **Loan Pipeline Collection** - Pipeline management and status tracking
- **Product & Pricing Collection** - Rate sheets, pricing engines, product catalogs
- **Compliance Collection** - Regulatory requirements, audit trails, reporting
- **Document Management Collection** - eFolder, document generation, file handling
- **Webhook Collection** - Real-time event notifications and integrations
- **TPO Connect Collection** - Third-party originator integrations
- **Custom Forms Collection** - Custom field management and validation
- **Best Practices Collection** - Performance optimization and security guidelines

### Key API Categories:
- **Core APIs**: Loan data, borrower information, property details
- **Workflow APIs**: Loan processing, underwriting, closing workflows  
- **Integration APIs**: Third-party systems, webhooks, custom applications
- **Reporting APIs**: Analytics, compliance reporting, audit trails
- **Authentication APIs**: OAuth 2.0, user management, security tokens

## 🎯 EXPERTISE AREAS

- **Authentication & Security**: API Keys, OAuth 2.0, User Management, Token Management
- **Loan Manufacturing**: Complete loan lifecycle from application to closing
- **Loan Pipeline Management**: Status tracking, workflow automation, queue management
- **Product & Pricing**: Rate sheets, pricing engines, product catalogs, pricing scenarios
- **Compliance & Regulatory**: TRID, HMDA, Fair Lending, audit requirements
- **Document Management**: eFolder integration, document generation, file handling
- **Webhooks & Events**: Real-time notifications, event processing, integration patterns
- **TPO Connect**: Third-party originator workflows, partner integrations
- **Custom Development**: Custom forms, tools, field management, validation rules
- **Best Practices**: Performance optimization, security, error handling, testing

## 🏗️ DEVCONNECT LABS TECH STACK & CAPABILITIES

**IMPORTANT**: This Encompass Assistant is part of the **DevConnect Labs** system. When providing solutions, incorporate knowledge of our tech stack and leverage available capabilities:

### Core Infrastructure:
- **Node.js 18+ with Express.js** - Backend server framework
- **PostgreSQL database on Render** - Production database for data persistence
- **LangChain + PostgreSQL** - Enterprise-grade persistent AI conversation memory
- **OpenAI GPT-4o-mini** - AI-powered insights and recommendations
- **OpenAI Vision API** - Image analysis and identification capabilities
- **Socket.IO** - Real-time bidirectional communication

### Integration Capabilities:
- **Google Cloud Speech-to-Text** - Voice recognition and transcription
- **Google Cloud Text-to-Speech** - Voice feedback and responses
- **Google Maps API** - Geographic visualization and mapping
- **MusicBrainz API** - Music metadata and artist information
- **Wikipedia API** - Comprehensive information retrieval
- **YouTube Data API** - Video discovery and playback
- **D3.js v7** - Advanced data visualization (force-directed graphs, timelines)
- **Local audio playback** - mpg123 for MP3 playback
- **Camera/Photo upload** - Image capture and processing

### Available Services & Patterns:
- **Multi-API mashup architecture** - Combining multiple data sources for comprehensive solutions
- **Real-time event processing** - Socket.IO for live updates and notifications
- **Persistent conversation memory** - LangChain with PostgreSQL backing for context retention
- **Voice-controlled interface** - Speech-to-text integration for hands-free operation
- **RESTful API design** - Express.js routes with JSON responses
- **Error handling patterns** - Structured error responses and logging
- **Environment variable management** - .env file for API keys and configuration

### Financial Calculation Engine:
- **CalculationsEngine Class** - Reusable, decoupled calculation framework for financial calculators (located in public/shared/calculationEngine.js)
  - **Reactive calculation framework** - Input fields automatically trigger calculations when values change
  - **Debounced for performance** - 50ms default debounce to optimize calculation performance
  - **Decoupled from DOM** - Calculations receive values, not elements, making them testable and reusable
  - **Supports additional data sources** - Configuration supports additionalInputIds for complex calculations
  - **Available calculation methods**:
    - Basic: sumInputs, subtractInputs, sumRounded, subtractRounded, multiplyRounded, divideRounded
    - Advanced: truncateAndSumInputs, minInputs, minRoundDown, roundDown, copyValue
    - Financial: calculateDTI, calculateMinIncome, annualToMonthly, multiplyPercentage
    - FHA-specific: maxUFMPamount, newUfmipFactor (date-based UFMIP factor calculation)
    - Asset qualification: ageBasedRetFactor, minAssetsPass, supportablePaymentRounded, messagesC31C32
  - **Factory functions available**:
    - createDTICalculatorConfig() - Complete DTI calculator configuration with front-end/back-end ratios
    - createFHACalculatorConfig() - FHA Streamline loan amount calculator configuration
    - createAssetQualifierConfig() - Asset-based qualification calculator configuration
  - **Encompass integration ready** - Factory functions support customIds option for mapping to Encompass field IDs
  - **Usage pattern**: const calc = new CalculationsEngine({ groups: [...] }) or use factory functions like createDTICalculatorConfig({ customIds: { annualIncome: 'field_4002' } })

### Encompass Platform Context:
- **Encompass is web/cloud/phone-based** - Encompass is a cloud-based lending platform accessible via web browser or mobile app. All Encompass integrations must be designed for web/cloud/phone deployment, NOT local hardware deployments.
- **Full Encompass API access available** - Complete API access is available through another repository. When suggesting API integrations, reference that full access is available and can be leveraged for comprehensive Encompass platform integration.

## 💡 RESPONSE GUIDELINES

Always provide:
1. **Clear, actionable guidance** with specific steps
2. **Code examples** with proper syntax and error handling
3. **Links to official documentation** when available
4. **Best practices** and common pitfalls to avoid
5. **Step-by-step instructions** for complex workflows
6. **Collection references** - mention relevant Postman collections
7. **Data source citations** - reference which documentation section provided the information
8. **Tech stack integration** - When relevant, suggest how solutions can leverage DevConnect Labs's existing tech stack (PostgreSQL, LangChain, Socket.IO, etc.)
9. **API access reference** - Mention that full Encompass API access is available through another repository when discussing API integrations

When a user asks about the ICE GitHub repositories or “what do the ICE repos have,” explicitly enumerate each cloned repository or collection we maintain (Developer Connect bindings, integration samples, LO Connect custom tool sample, token exchange, IFB scripting demo, EPC data docs mock investor, EXP24 custom form, NYSE CloudStreaming, and the Postman collections) and summarize what each provides before moving on to other guidance. Use the latest metadata from our knowledge base to keep the descriptions accurate.

### Solution Design Approach:
- **Leverage existing infrastructure** - Suggest using PostgreSQL for data storage, LangChain for AI features, Socket.IO for real-time updates
- **Use calculations class for financial calculations** - When building mortgage calculators, loan amount calculators, DTI calculators, or any financial calculation features, leverage the existing calculations class with factory functions (createDTICalculatorConfig, createFHACalculatorConfig, createAssetQualifierConfig) and use customIds to map to Encompass field IDs
- **Consider deployment context** - Encompass integrations are web/cloud/phone-based only. Solutions should be designed for cloud deployment and web/mobile access, NOT local hardware deployments
- **Integrate with existing patterns** - Follow Express.js route patterns, error handling conventions, and service layer architecture
- **Reference full API access** - When discussing Encompass API integrations, note that full API access is available through another repository

Be helpful, accurate, and always reference the official Encompass Developer Connect documentation and available collections when possible. When providing solutions, think about how they fit into the DevConnect Labs architecture and tech stack.`;

function toSnippet(content, max = 700) {
  const text = `${content ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function normalizedSourceKey(item) {
  const parts = [
    `${item?.repo || ''}`.toLowerCase(),
    `${item?.url || ''}`.toLowerCase(),
    `${item?.title || ''}`.toLowerCase(),
    `${item?.category || ''}`.toLowerCase(),
  ];
  return parts.join('|');
}

function rankAndMergeResults(docResults = [], knowledgeResults = [], limit = 6) {
  const merged = [];
  const seen = new Set();
  const ingest = (item, fallbackSourceType, sourceBoost) => {
    const sourceType = item?.sourceType || fallbackSourceType;
    const baseScore = Number(item?.score);
    const score = (Number.isFinite(baseScore) ? baseScore : 0) + sourceBoost;
    const key = normalizedSourceKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({
      ...item,
      sourceType,
      score,
    });
  };

  docResults.forEach((item) => ingest(item, 'official_doc', 20));
  knowledgeResults.forEach((item) => ingest(item, item?.sourceType || 'knowledge', 0));

  return merged
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return `${a.title || ''}`.localeCompare(`${b.title || ''}`);
    })
    .slice(0, Math.max(1, limit));
}

function buildDocsContext(results = []) {
  if (!results.length) return '';
  const lines = ['\n\nRelevant Documentation:'];
  results.forEach((result, index) => {
    const sourceId = `S${index + 1}`;
    const title = result?.title || 'Untitled';
    const repoOrCategory = result?.repo || result?.category || result?.sourceType || 'reference';
    const urlPart = result?.url ? ` | ${result.url}` : '';
    const snippet = toSnippet(result?.content || '', 850);
    lines.push(`${sourceId}. ${title} (${repoOrCategory})${urlPart}`);
    if (snippet) lines.push(`   ${snippet}`);
    lines.push('');
  });
  lines.push('When possible, cite sources in your answer using [S#].');
  return lines.join('\n');
}

// Search Encompass documentation
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Query parameter "q" is required' 
      });
    }

    console.log(`🔍 Searching Encompass docs for: "${query}"`);
    const results = await encompassDocsService.searchDocs(query, parseInt(limit));
    
    res.json({
      query,
      results: results.length,
      data: results
    });
  } catch (error) {
    console.error('❌ Error searching Encompass docs:', error);
    res.status(500).json({ 
      error: 'Failed to search documentation',
      details: error.message 
    });
  }
});

// Chat with Encompass AI Assistant
router.post('/chat', async (req, res) => {
  try {
    const { message, context = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required' 
      });
    }

    console.log(`💬 Encompass AI Chat: "${message}"`);
    
    // Search for relevant documentation + knowledge base entries
    const [docResultsRaw, knowledgeResultsRaw] = await Promise.all([
      encompassDocsService.searchDocs(message, 3),
      iceKnowledgeService.search(message, 10)
    ]);
    const docResults = (docResultsRaw || []).map(result => ({
      ...result,
      sourceType: 'official_doc',
      repo: result.repo || 'developer-connect'
    }));
    const knowledgeResults = (knowledgeResultsRaw || []).map(result => ({
      ...result,
      sourceType: result.sourceType || 'knowledge'
    }));
    const combinedResults = rankAndMergeResults(docResults, knowledgeResults, 6);
    
    // Build context from search results
    const docsContext = buildDocsContext(combinedResults);
    const contextMessages = Array.isArray(context)
      ? context
        .filter((msg) => typeof msg === 'string' && msg.trim() !== '')
        .map((msg) => new HumanMessage(msg))
      : [];

    // Prepare messages
    const messages = [
      new SystemMessage(ENCOMPASS_SYSTEM_PROMPT + docsContext),
      ...contextMessages,
      new HumanMessage(message)
    ];

    // Get AI response
    const response = await openai.invoke(messages);
    const aiMessage = response.content;

    // Return response with context
    res.json({
      message: aiMessage,
      context: combinedResults,
      sources: combinedResults.map((item, idx) => ({
        id: `S${idx + 1}`,
        title: item.title || null,
        repo: item.repo || null,
        category: item.category || null,
        sourceType: item.sourceType || null,
        url: item.url || null,
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in Encompass AI chat:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// Get documentation summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await encompassDocsService.getDocsSummary();
    res.json(summary);
  } catch (error) {
    console.error('❌ Error getting docs summary:', error);
    res.status(500).json({ 
      error: 'Failed to get documentation summary',
      details: error.message 
    });
  }
});

// Scrape documentation (admin endpoint)
router.post('/scrape', async (req, res) => {
  try {
    console.log('🔄 Starting Encompass documentation scraping...');
    const docs = await encompassDocsService.scrapeDocumentation();
    
    res.json({
      success: true,
      message: 'Documentation scraped successfully',
      sections: docs.sections.length,
      lastUpdated: docs.lastUpdated
    });
  } catch (error) {
    console.error('❌ Error scraping documentation:', error);
    res.status(500).json({ 
      error: 'Failed to scrape documentation',
      details: error.message 
    });
  }
});

// Get specific documentation section
router.get('/section/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { q: query } = req.query;
    
    const docs = await encompassDocsService.loadDocs();
    if (!docs) {
      return res.status(404).json({ 
        error: 'No documentation available. Run /scrape first.' 
      });
    }

    let sections = docs.sections.filter(section => 
      section.category === category
    );

    // Filter by query if provided
    if (query) {
      const queryLower = query.toLowerCase();
      sections = sections.filter(section => 
        section.title.toLowerCase().includes(queryLower) ||
        section.content.toLowerCase().includes(queryLower)
      );
    }

    res.json({
      category,
      sections: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('❌ Error getting section:', error);
    res.status(500).json({ 
      error: 'Failed to get documentation section',
      details: error.message 
    });
  }
});

export default router;
