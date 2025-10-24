import express from 'express';
import encompassDocsService from '../services/encompass-docs.service.js';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

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

## 💡 RESPONSE GUIDELINES

Always provide:
1. **Clear, actionable guidance** with specific steps
2. **Code examples** with proper syntax and error handling
3. **Links to official documentation** when available
4. **Best practices** and common pitfalls to avoid
5. **Step-by-step instructions** for complex workflows
6. **Collection references** - mention relevant Postman collections
7. **Data source citations** - reference which documentation section provided the information

Be helpful, accurate, and always reference the official Encompass Developer Connect documentation and available collections when possible.`;

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
    
    // Search for relevant documentation
    const searchResults = await encompassDocsService.searchDocs(message, 3);
    
    // Build context from search results
    let docsContext = '';
    if (searchResults.length > 0) {
      docsContext = '\n\nRelevant Documentation:\n';
      searchResults.forEach((result, index) => {
        docsContext += `${index + 1}. ${result.title} (${result.category})\n`;
        docsContext += `   ${result.content.substring(0, 1000)}...\n\n`;
      });
    }

    // Prepare messages
    const messages = [
      new SystemMessage(ENCOMPASS_SYSTEM_PROMPT + docsContext),
      ...context.map(msg => new HumanMessage(msg)),
      new HumanMessage(message)
    ];

    // Get AI response
    const response = await openai.invoke(messages);
    const aiMessage = response.content;

    // Return response with context
    res.json({
      message: aiMessage,
      context: searchResults,
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
