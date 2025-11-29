/**
 * Type definitions for Encompass documentation service and API
 */

export interface EncompassDocSection {
  title: string;
  category: string;
  content: string;
  url: string;
}

export interface EncompassDocsData {
  lastUpdated: string;
  sections: EncompassDocSection[];
}

export interface EncompassSearchResult {
  title: string;
  category: string;
  content: string;
  url: string;
  sourceType?: string;
  repo?: string;
  path?: string;
  tags?: string[];
  relevanceScore?: number;
  score?: number;
}

export interface EncompassChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface EncompassChatRequest {
  message: string;
  context?: EncompassChatMessage[];
}

export interface EncompassChatResponse {
  message: string;
  context?: EncompassSearchResult[];
  timestamp: string;
}

export interface EncompassDocsSummary {
  totalSections: number;
  categories: string[];
  lastUpdated: string;
}

