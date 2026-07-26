/**
 * Encompass RAG Integration Example
 * 
 * Demonstrates how to use Python service for Encompass knowledge retrieval
 * and RAG (Retrieval Augmented Generation) operations.
 * 
 * Usage:
 *   node examples/encompass-rag-example.js
 */

import pythonClient from '../services/python-client.service.js';

async function main() {
  console.log('Encompass RAG Integration Example\n');
  console.log('=' .repeat(60));

  try {
    // Check if Python service is available
    console.log('\n1. Checking Python service availability...');
    const isAvailable = await pythonClient.isAvailable();
    console.log(`   Python service: ${isAvailable ? '✓ Available' : '✗ Unavailable'}`);

    if (!isAvailable) {
      console.log('\n   Please start the Python service first:');
      console.log('   npm run python:dev');
      return;
    }

    // Get knowledge summary
    console.log('\n2. Getting ICE knowledge summary...');
    const summary = await pythonClient.getKnowledgeSummary();
    console.log('   Summary:', JSON.stringify(summary.summary, null, 2));

    // Search ICE knowledge base
    console.log('\n3. Searching ICE knowledge for "loan application"...');
    const iceResults = await pythonClient.searchICEKnowledge('loan application', {
      limit: 5
    });
    console.log(`   Found ${iceResults.count} results`);
    if (iceResults.results.length > 0) {
      iceResults.results.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title || 'Untitled'}`);
        console.log(`      Source: ${result.source_type || 'unknown'}`);
        console.log(`      Rank: ${result.rank?.toFixed(3) || 'N/A'}`);
      });
    }

    // Search Encompass docs
    console.log('\n4. Searching Encompass docs for "OAuth authentication"...');
    const docsResults = await pythonClient.searchEncompassDocs('OAuth authentication', {
      limit: 5
    });
    console.log(`   Found ${docsResults.count} results`);
    if (docsResults.results.length > 0) {
      docsResults.results.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title || 'Untitled'}`);
        console.log(`      Category: ${result.category || 'unknown'}`);
        console.log(`      URL: ${result.url || 'N/A'}`);
      });
    }

    // Get field information
    console.log('\n5. Getting information for field ID "4000"...');
    try {
      const fieldInfo = await pythonClient.getFieldInfo('4000');
      console.log(`   Found ${fieldInfo.field_info.references?.length || 0} references`);
      if (fieldInfo.field_info.references?.length > 0) {
        const ref = fieldInfo.field_info.references[0];
        console.log(`   Example: ${ref.title || 'Untitled'}`);
        console.log(`   Source: ${ref.source_type || 'unknown'}`);
      }
    } catch (error) {
      console.log('   Field not found or no references');
    }

    // Text processing examples
    console.log('\n6. Text processing examples...');
    
    const sampleText = `
      The Encompass API provides access to loan data through Fields.4000 and 
      Loan.LoanAmount fields. You can retrieve this data using the 
      /encompass/v1/loans endpoint with proper OAuth 2.0 authentication.
    `;

    // Extract field IDs
    const fieldIds = await pythonClient.extractFieldIds(sampleText);
    console.log(`   Extracted field IDs: ${fieldIds.field_ids.join(', ')}`);

    // Extract API endpoints
    const endpoints = await pythonClient.extractApiEndpoints(sampleText);
    console.log(`   Extracted endpoints: ${endpoints.endpoints.join(', ')}`);

    // Extract keywords
    const keywords = await pythonClient.extractKeywords(sampleText, { topN: 5 });
    console.log('   Top keywords:');
    keywords.keywords.forEach(kw => {
      console.log(`     - ${kw.keyword}: ${kw.frequency} occurrences`);
    });

    // Calculate readability
    const readability = await pythonClient.calculateReadability(sampleText);
    console.log('   Readability metrics:');
    console.log(`     - Sentences: ${readability.metrics.sentences}`);
    console.log(`     - Words: ${readability.metrics.words}`);
    console.log(`     - Avg words/sentence: ${readability.metrics.avg_words_per_sentence}`);

    // Hybrid search example (requires embeddings)
    console.log('\n7. Hybrid search (keyword only, no embeddings)...');
    const hybridResults = await pythonClient.hybridSearch('custom fields', {
      limit: 5
    });
    console.log(`   Found ${hybridResults.count} results`);
    if (hybridResults.results.length > 0) {
      hybridResults.results.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title || 'Untitled'}`);
        console.log(`      Combined score: ${result.combined_score?.toFixed(3) || 'N/A'}`);
      });
    }

    // Prepare RAG context
    if (iceResults.results.length > 0) {
      console.log('\n8. Preparing RAG context from search results...');
      const ragContext = await pythonClient.prepareRAGContext(
        iceResults.results,
        1500 // max tokens
      );
      console.log(`   Context prepared: ${ragContext.sources_used} sources used`);
      console.log(`   Context length: ${ragContext.context.length} characters`);
      console.log('\n   Context preview:');
      console.log(ragContext.context.slice(0, 300) + '...');
    }

    console.log('\n' + '=' .repeat(60));
    console.log('Example completed successfully!\n');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('\nMake sure:');
    console.error('1. The Python service is running (npm run python:dev)');
    console.error('2. Your .env file has DATABASE_URL configured');
    console.error('3. The database has ICE knowledge and Encompass docs tables');
    console.error('4. You have run the knowledge build scripts:');
    console.error('   - npm run build:ice-knowledge');
    console.error('   - npm run scrape:encompass-docs');
    process.exit(1);
  }
}

main();
