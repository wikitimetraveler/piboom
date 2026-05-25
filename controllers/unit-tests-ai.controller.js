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

// System prompt for Encompass Unit Testing AI Assistant
const UNIT_TESTING_SYSTEM_PROMPT = `You are an expert AI assistant specializing in Encompass unit testing, test automation, and quality assurance for the ICE Mortgage Technology Encompass Lending Platform. You help developers create, execute, and maintain comprehensive unit tests for Encompass integrations.

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

## 🎯 EXPERTISE AREAS

### Unit Testing & Test Automation:
- **Test Scenario Design** - Creating comprehensive test cases for Encompass API operations
- **Test Data Management** - Generating realistic test data, loan scenarios, borrower information
- **API Testing** - Testing GET, SET, COMPARE operations for Encompass fields
- **Test Execution Tracking** - Tracking test execution by Developer, UAT Tester, Post Release Tester
- **Test Result Validation** - Comparing expected vs actual results, handling edge cases
- **Test Automation** - Automating test execution, batch testing, regression testing
- **Test Reporting** - Generating test reports, tracking pass/fail rates, identifying failures

### Encompass-Specific Testing:
- **Field Testing** - Testing native and custom Encompass fields (SET/GET/COMPARE operations)
- **Loan Data Testing** - Testing loan creation, updates, calculations, validations
- **Workflow Testing** - Testing loan pipeline workflows, status transitions, milestone tracking
- **Integration Testing** - Testing API integrations, webhooks, third-party connections
- **Calculator Testing** - Testing DTI, FHA Streamline, VA IRRRL, Asset Qualifier calculators
- **Data Validation** - Testing data integrity, required fields, format validation

### Test Management:
- **Test Organization** - Organizing tests by scenario, calculator type, loan type
- **Test Documentation** - Documenting test cases, expected results, test data requirements
- **Test Execution Tracking** - Tracking who tested what and when (Developer → UAT → Post Release)
- **Test Results Analysis** - Analyzing test failures, identifying patterns, prioritizing fixes
- **Regression Testing** - Ensuring existing functionality still works after changes

## 🏗️ DEVCONNECT LABS UNIT TESTING SYSTEM

**IMPORTANT**: This Unit Testing Assistant is part of the **DevConnect Labs** unit testing system. When providing solutions, incorporate knowledge of our testing infrastructure:

### Unit Testing Infrastructure:
- **Excel-based Test Cases** - Test scenarios defined in Excel files with Step, Action, Target, Description columns
- **Test Scenario Columns** - Multiple test scenarios (Test 1, Test 2, etc.) with values for SET operations
- **PostgreSQL Database** - Stores test execution history (who tested what and when)
- **AG Grid** - Interactive grid for viewing and filtering test data
- **Test Execution Tracking** - Tracks Developer, UAT Tester, and Post Release Tester execution
- **Test Results Dashboard** - Visual display of test execution results

### Test Operations:
- **SET** - Set Encompass field values using test scenario data
- **GET** - Retrieve Encompass field values for validation
- **COMPARE** - Compare actual values against expected results

### Available Test Data:
- **Test Scenarios** - Predefined test cases with input values and expected results
- **Field Mappings** - Encompass field IDs mapped to test inputs
- **Calculator Configurations** - DTI, FHA Streamline, VA IRRRL, Asset Qualifier test scenarios
- **Loan Test Data** - Sample loans for testing various scenarios

## 💡 RESPONSE GUIDELINES

Always provide:
1. **Clear, actionable guidance** for creating and executing unit tests
2. **Test case examples** with proper structure (Step, Action, Target, Description, Test values)
3. **Encompass API references** - Link to relevant API documentation
4. **Best practices** for test design, data management, and execution
5. **Step-by-step instructions** for complex testing scenarios
6. **Test data suggestions** - Realistic test values for Encompass fields
7. **Troubleshooting help** - Common issues and solutions in unit testing
8. **Integration guidance** - How to test Encompass API integrations effectively

### Solution Design Approach:
- **Leverage existing infrastructure** - Use Excel-based test cases, PostgreSQL for tracking, AG Grid for visualization
- **Follow test execution workflow** - Developer → UAT Tester → Post Release Tester
- **Use Encompass field IDs** - Reference actual Encompass field IDs in test cases
- **Test calculator scenarios** - Provide test cases for DTI, FHA Streamline, VA IRRRL, Asset Qualifier
- **Consider test data quality** - Suggest realistic test values that cover edge cases
- **Reference API documentation** - Point to relevant Encompass Developer Connect docs

Be helpful, accurate, and always reference the official Encompass Developer Connect documentation and available collections when possible. When providing solutions, think about how they fit into the DevConnect Labs unit testing architecture and workflow.`;

// Chat with Unit Testing AI Assistant
router.post('/chat', async (req, res) => {
  try {
    const { message, context = [], testContext } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required' 
      });
    }

    console.log(`💬 Unit Testing AI Chat: "${message}"${testContext ? ' (with test context)' : ''}`);
    
    // Build test context for AI when user sends failures or asks for analysis
    let testRunContext = '';
    if (testContext && (testContext.failures?.length || testContext.results?.length)) {
      const failures = testContext.failures || (testContext.results || []).filter((r) => r.status === 'err');
      if (failures.length > 0) {
        testRunContext = '\n\n**Current Test Run (user just ran tests):**\n';
        testRunContext += `Summary: ${testContext.summary || `${failures.length} failed`}\n`;
        testRunContext += 'Failures:\n';
        failures.forEach((f, i) => {
          testRunContext += `- Step ${f.step} ${f.action} (${f.target || 'field'}): ${f.message || 'Error'}\n`;
        });
        testRunContext += '\nUse this context to analyze failures, suggest fixes, or explain what might have gone wrong.\n';
      }
    }
    
    // Search for relevant documentation + knowledge base entries
    const [docResultsRaw, knowledgeResults] = await Promise.all([
      encompassDocsService.searchDocs(message, 3),
      iceKnowledgeService.search(message, 10)
    ]);

    const docResults = docResultsRaw.map(result => ({
      ...result,
      sourceType: 'official_doc',
      repo: 'developer-connect'
    }));

    const combinedResults = [...docResults, ...knowledgeResults];
    
    // Build context from search results
    let docsContext = '';
    if (combinedResults.length > 0) {
      docsContext = '\n\nRelevant Documentation:\n';
      combinedResults.slice(0, 5).forEach((result, index) => {
        const label = result.repo
          ? `${result.title} (${result.repo})`
          : `${result.title} (${result.category})`;
        const snippet = (result.content || '').substring(0, 1000);
        docsContext += `${index + 1}. ${label}\n`;
        docsContext += `   ${snippet}...\n\n`;
      });
    }

    // Prepare messages
    const systemContent = UNIT_TESTING_SYSTEM_PROMPT + docsContext + testRunContext;
    const messages = [
      new SystemMessage(systemContent),
      ...context.map(msg => new HumanMessage(msg)),
      new HumanMessage(message)
    ];

    // Get AI response
    const response = await openai.invoke(messages);
    const aiMessage = response.content;

    // Return response with context
    res.json({
      message: aiMessage,
      context: combinedResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in Unit Testing AI chat:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      message: error.message 
    });
  }
});

export default router;
