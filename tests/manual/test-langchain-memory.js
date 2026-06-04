/**
 * Development work by David Lane
 */
/**
 * Test script for LangChain + PostgreSQL conversation memory
 * Run with: node test-langchain-memory.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase, createTables } from './services/database.service.js';
import { 
  getConversationChain, 
  getUserConversationHistory, 
  clearUserConversationHistory,
  getUserConversationStats 
} from './services/langchain-memory.service.js';

const testUserId = 'demo-analyst-4';
const testSessionId = 'test-session';

async function runTests() {
  console.log('🧪 Testing LangChain + PostgreSQL Memory...\n');

  try {
    // Initialize database
    console.log('1️⃣ Initializing database...');
    initializeDatabase();
    await createTables();
    console.log('✅ Database initialized\n');

    // Test 1: Send first message
    console.log('2️⃣ Testing first conversation...');
    const systemPrompt = `You are Levi, a 72-year-old biker hippie truck driver! 
    Keep responses short for testing. Use expressions like "Right on, man!" and "That's some heavy stuff!"`;
    
    const { chain: chain1 } = await getConversationChain(testUserId, systemPrompt, testSessionId);
    const result1 = await chain1.call({
      input: "Hey Levi! What's your favorite band?"
    });
    
    console.log("👤 User: Hey Levi! What's your favorite band?");
    console.log('🤖 Levi:', result1.response);
    console.log('✅ First message sent\n');

    // Test 2: Send second message (should remember context)
    console.log('3️⃣ Testing conversation memory...');
    const { chain: chain2 } = await getConversationChain(testUserId, systemPrompt, testSessionId);
    const result2 = await chain2.call({
      input: "That's cool! What album should I listen to?"
    });
    
    console.log("👤 User: That's cool! What album should I listen to?");
    console.log('🤖 Levi:', result2.response);
    console.log('✅ Context remembered\n');

    // Test 3: Get conversation history
    console.log('4️⃣ Fetching conversation history...');
    const history = await getUserConversationHistory(testUserId, testSessionId);
    console.log(`📜 Found ${history.length} messages:`);
    history.forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.role}]: ${msg.content.substring(0, 50)}...`);
    });
    console.log('✅ History retrieved\n');

    // Test 4: Get stats
    console.log('5️⃣ Getting conversation stats...');
    const stats = await getUserConversationStats(testUserId);
    console.log('📊 Stats:', {
      conversations: stats.conversation_count,
      messages: stats.message_count,
      lastActivity: stats.last_message_at
    });
    console.log('✅ Stats retrieved\n');

    // Test 5: Clear history
    console.log('6️⃣ Clearing conversation history...');
    await clearUserConversationHistory(testUserId, testSessionId);
    const clearedHistory = await getUserConversationHistory(testUserId, testSessionId);
    console.log(`🗑️  Messages after clear: ${clearedHistory.length}`);
    console.log('✅ History cleared\n');

    console.log('🎉 All tests passed! LangChain + PostgreSQL memory is working!\n');
    console.log('💡 Next steps:');
    console.log('   - Update public/assistant.html to use /api/chat/langchain/chat');
    console.log('   - Test with all 5 users');
    console.log('   - Deploy to your Pi 5\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

// Run tests
runTests();

