/**
 * Complete RAG Workflow Example
 * 
 * Demonstrates a full RAG (Retrieval Augmented Generation) workflow:
 * 1. User asks a question about Encompass
 * 2. System searches knowledge base
 * 3. Prepares context from results
 * 4. (Optional) Sends to OpenAI with context
 * 
 * Usage:
 *   node examples/rag-workflow-example.js
 */

import pythonClient from '../services/python-client.service.js';
import OpenAI from 'openai';

// Set to true if you want to actually call OpenAI
const CALL_OPENAI = process.env.OPENAI_API_KEY ? true : false;

async function performRAGWorkflow(question) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`QUESTION: ${question}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Check Python service availability
    console.log('\nStep 1: Checking Python service...');
    const isAvailable = await pythonClient.isAvailable();
    if (!isAvailable) {
      throw new Error('Python service not available. Run: npm run python:dev');
    }
    console.log('✓ Python service is available');

    // Step 2: Search knowledge base (keyword search)
    console.log('\nStep 2: Searching knowledge base...');
    const searchResults = await pythonClient.searchICEKnowledge(question, {
      limit: 10
    });
    console.log(`✓ Found ${searchResults.count} results`);

    if (searchResults.count === 0) {
      console.log('✗ No results found. Try a different query.');
      return null;
    }

    // Show top results
    console.log('\nTop 5 results:');
    searchResults.results.slice(0, 5).forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.title || 'Untitled'}`);
      console.log(`     Source: ${result.source_type || 'unknown'}`);
      console.log(`     Rank: ${result.rank?.toFixed(3) || 'N/A'}`);
    });

    // Step 3: Extract technical details from question
    console.log('\nStep 3: Analyzing question...');
    const fieldIds = await pythonClient.extractFieldIds(question);
    const endpoints = await pythonClient.extractApiEndpoints(question);
    const keywords = await pythonClient.extractKeywords(question, { topN: 5 });

    console.log('✓ Analysis complete:');
    if (fieldIds.field_ids.length > 0) {
      console.log(`  Field IDs: ${fieldIds.field_ids.join(', ')}`);
    }
    if (endpoints.endpoints.length > 0) {
      console.log(`  Endpoints: ${endpoints.endpoints.join(', ')}`);
    }
    console.log(`  Key terms: ${keywords.keywords.map(k => k.keyword).join(', ')}`);

    // Step 4: Get additional context for any field IDs mentioned
    if (fieldIds.field_ids.length > 0) {
      console.log('\nStep 4: Looking up field information...');
      for (const fieldId of fieldIds.field_ids.slice(0, 3)) {
        try {
          const fieldInfo = await pythonClient.getFieldInfo(fieldId);
          if (fieldInfo.field_info.references.length > 0) {
            console.log(`✓ Found ${fieldInfo.field_info.references.length} references for ${fieldId}`);
            // Add field references to search results
            searchResults.results.push(...fieldInfo.field_info.references.map(ref => ({
              title: `Field ${fieldId}: ${ref.title}`,
              excerpt: ref.excerpt,
              url: ref.url,
              source_type: 'field_reference'
            })));
          }
        } catch (err) {
          console.log(`  No additional info found for ${fieldId}`);
        }
      }
    } else {
      console.log('\nStep 4: Skipped (no field IDs found)');
    }

    // Step 5: Prepare context for RAG
    console.log('\nStep 5: Preparing RAG context...');
    const ragContext = await pythonClient.prepareRAGContext(
      searchResults.results,
      3000 // max tokens for GPT-4
    );
    
    console.log(`✓ Context prepared:`);
    console.log(`  Sources used: ${ragContext.sources_used}`);
    console.log(`  Context length: ${ragContext.context.length} chars`);
    console.log(`  Est. tokens: ~${Math.round(ragContext.context.length / 4)}`);

    // Step 6: (Optional) Call OpenAI
    if (CALL_OPENAI) {
      console.log('\nStep 6: Querying OpenAI with context...');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an Encompass API expert. Use the following context from the ICE knowledge base and Encompass documentation to answer questions accurately.\n\nContext:\n${ragContext.context}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.3
      });

      const answer = completion.choices[0].message.content;
      
      console.log('\n✓ OpenAI Response:');
      console.log('─'.repeat(80));
      console.log(answer);
      console.log('─'.repeat(80));

      return {
        question,
        answer,
        sources: ragContext.sources,
        context_used: true
      };
    } else {
      console.log('\nStep 6: Skipped (OpenAI API key not configured)');
      console.log('\nContext preview (first 500 chars):');
      console.log('─'.repeat(80));
      console.log(ragContext.context.slice(0, 500) + '...');
      console.log('─'.repeat(80));

      return {
        question,
        context: ragContext.context.slice(0, 500),
        sources: ragContext.sources,
        context_used: false
      };
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    throw error;
  }
}

async function main() {
  console.log('RAG Workflow Example');
  console.log('='.repeat(80));

  // Example questions
  const questions = [
    'How do I authenticate with the Encompass API using OAuth?',
    'What is field 4000 used for in custom fields?',
    'How do I retrieve loan data from /encompass/v1/loans endpoint?',
    'What are the best practices for custom field validation?'
  ];

  console.log('\nThis example demonstrates a complete RAG workflow:');
  console.log('1. Search knowledge base for relevant information');
  console.log('2. Extract technical details from the question');
  console.log('3. Look up additional context for field IDs');
  console.log('4. Prepare context for LLM');
  console.log('5. (Optional) Query OpenAI with context\n');

  // Process first question
  const result = await performRAGWorkflow(questions[0]);

  if (result) {
    console.log('\n✓ Workflow completed successfully!');
    console.log(`\nContext was ${result.context_used ? 'sent to OpenAI' : 'prepared (OpenAI call skipped)'}`);
    console.log(`Used ${result.sources.length} knowledge sources`);
  }

  // Show other example questions
  console.log('\n\nTry these other questions:');
  questions.slice(1).forEach((q, i) => {
    console.log(`  ${i + 2}. ${q}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('Example completed!\n');

  if (!CALL_OPENAI) {
    console.log('💡 Tip: Set OPENAI_API_KEY in .env to enable actual OpenAI queries\n');
  }
}

main().catch(error => {
  console.error('\nFatal error:', error.message);
  console.error('\nMake sure:');
  console.error('1. Python service is running (npm run python:dev)');
  console.error('2. Database has ICE knowledge (npm run build:ice-knowledge)');
  console.error('3. Database has Encompass docs (npm run scrape:encompass-docs)');
  process.exit(1);
});
