/**
 * Development work by David Lane
 */
import { ChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "@langchain/classic/memory";
import { ConversationChain } from "@langchain/classic/chains";
import { ChatMessageHistory } from "@langchain/classic/stores/message/in_memory";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getPool } from './database.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';

/**
 * PostgreSQL-backed conversation memory for LangChain
 * Persists conversation history per user in the database
 */
class PostgreSQLChatMessageHistory extends ChatMessageHistory {
  constructor(userId, sessionId = 'default', conversationId = null) {
    super();
    this.userId = userId;
    this.sessionId = sessionId;
    this.conversationId = conversationId;
    this.pool = getPool();
    this.initialized = false;
  }

  /**
   * Initialize conversation and load history from database
   */
  async initialize() {
    if (this.initialized || !this.pool) {
      return;
    }

    try {
      // Get or create conversation
      const conversationResult = await this.pool.query(
        `INSERT INTO conversations (user_id, session_id, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, session_id)
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [this.userId, this.sessionId]
      );
      
      this.conversationId = conversationResult.rows[0].id;

      // Load existing messages from database (last 20 messages for context)
      const messagesResult = await this.pool.query(
        `SELECT role, content FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC
         LIMIT 20`,
        [this.conversationId]
      );

      // Populate in-memory history
      this.messages = messagesResult.rows.map(row => {
        switch (row.role) {
          case 'user':
            return new HumanMessage(row.content);
          case 'assistant':
            return new AIMessage(row.content);
          case 'system':
            return new SystemMessage(row.content);
          default:
            return new HumanMessage(row.content);
        }
      });

      this.initialized = true;
    } catch (error) {
      console.error('❌ Error initializing conversation history:', error.message);
      this.messages = [];
    }
  }

  /**
   * Add a message to history and persist to database
   */
  async addMessage(message) {
    if (!this.pool) {
      // Fallback to in-memory only if database not available
      return super.addMessage(message);
    }

    if (!this.initialized) {
      await this.initialize();
    }

    // Add to in-memory history
    await super.addMessage(message);

    // Persist to database
    try {
      const langchainRole = message._getType();
      
      // Map LangChain role names to database role names
      const roleMap = {
        'human': 'user',
        'ai': 'assistant',
        'system': 'system'
      };
      
      const role = roleMap[langchainRole] || 'user';
      const content = message.content;

      await this.pool.query(
        `INSERT INTO messages (conversation_id, user_id, role, content)
         VALUES ($1, $2, $3, $4)`,
        [this.conversationId, this.userId, role, content]
      );
    } catch (error) {
      console.error('❌ Error persisting message:', error.message);
    }
  }

  /**
   * Clear conversation history (both in-memory and database)
   */
  async clear() {
    await super.clear();

    if (!this.pool || !this.conversationId) {
      return;
    }

    try {
      await this.pool.query(
        `DELETE FROM messages WHERE conversation_id = $1`,
        [this.conversationId]
      );
    } catch (error) {
      console.error('❌ Error clearing conversation history:', error.message);
    }
  }
}

/**
 * Get or create a LangChain conversation chain with PostgreSQL memory
 */
export async function getConversationChain(userId, systemPrompt, sessionId = 'default') {
  const pool = getPool();
  
  if (!pool) {
    console.warn('⚠️  Database not available - using in-memory history only');
  }

  // Create chat history with PostgreSQL backing
  const chatHistory = new PostgreSQLChatMessageHistory(userId, sessionId);
  await chatHistory.initialize();

  // Create BufferMemory with our custom history
  const memory = new BufferMemory({
    chatHistory: chatHistory,
    returnMessages: true,
    memoryKey: "history",
  });

  // Create OpenAI chat model
  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('LANGCHAIN_CHAT_MODEL'),
    temperature: 0.8,
    maxTokens: 600,
    openAIApiKey: (process.env.OPENAI_API_KEY || '').trim(),
  });

  // Create conversation chain
  const chain = new ConversationChain({
    llm: model,
    memory: memory,
  });

  return { chain, memory, chatHistory };
}

/**
 * Get conversation history for a user
 */
export async function getUserConversationHistory(userId, sessionId = 'default', limit = 50) {
  const pool = getPool();
  
  if (!pool) {
    return [];
  }

  try {
    const result = await pool.query(
      `SELECT m.role, m.content, m.created_at
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND c.session_id = $2
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [userId, sessionId, limit]
    );

    return result.rows.reverse(); // Return in chronological order
  } catch (error) {
    console.error('❌ Error getting conversation history:', error.message);
    return [];
  }
}

/**
 * Clear conversation history for a user
 */
export async function clearUserConversationHistory(userId, sessionId = 'default') {
  const pool = getPool();
  
  if (!pool) {
    return false;
  }

  try {
    await pool.query(
      `DELETE FROM messages
       WHERE conversation_id IN (
         SELECT id FROM conversations
         WHERE user_id = $1 AND session_id = $2
       )`,
      [userId, sessionId]
    );

    return true;
  } catch (error) {
    console.error('❌ Error clearing conversation history:', error.message);
    return false;
  }
}

/**
 * Get conversation statistics for a user
 */
export async function getUserConversationStats(userId) {
  const pool = getPool();
  
  if (!pool) {
    return null;
  }

  try {
    const result = await pool.query(
      `SELECT 
         COUNT(DISTINCT c.id) as conversation_count,
         COUNT(m.id) as message_count,
         MAX(m.created_at) as last_message_at
       FROM conversations c
       LEFT JOIN messages m ON m.conversation_id = c.id
       WHERE c.user_id = $1`,
      [userId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('❌ Error getting conversation stats:', error.message);
    return null;
  }
}

export default {
  getConversationChain,
  getUserConversationHistory,
  clearUserConversationHistory,
  getUserConversationStats
};

