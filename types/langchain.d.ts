/**
 * Type definitions for LangChain memory service
 */

import { ConversationChain } from 'langchain/chains';
import { BaseMessage } from '@langchain/core/messages';

export type UserId = 
  | 'cosmic-turtle'
  | 'easy-levi'
  | 'wizened-wizard'
  | 'jerry-garcia'
  | 'fuzz-maestro'
  | string;

export type ConversationRole = 'user' | 'assistant' | 'system';

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  created_at: Date | string;
}

export interface Conversation {
  id: number;
  user_id: UserId;
  session_id: string;
  assistant_type?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  lastMessageAt: Date | string | null;
}

export interface LangChainMemoryService {
  getConversationChain: (
    userId: UserId,
    systemPrompt: string,
    sessionId?: string
  ) => Promise<ConversationChain>;
  
  getUserConversationHistory: (
    userId: UserId,
    sessionId?: string,
    limit?: number
  ) => Promise<ConversationMessage[]>;
  
  clearUserConversationHistory: (
    userId: UserId,
    sessionId?: string
  ) => Promise<void>;
  
  getUserConversationStats: (
    userId: UserId
  ) => Promise<ConversationStats>;
}

