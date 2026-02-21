import type { SessionUsageData } from '@tokentop/plugin-sdk';

export interface WindsurfMessageEntry {
  role?: string;
  content?: string | unknown[];
  text?: string;
  model?: string;
  modelId?: string;
  id?: string;
  timestamp?: string | number;
  type?: string;
}

export interface WindsurfConversationData {
  id?: string;
  conversationId?: string;
  title?: string;
  messages?: WindsurfMessageEntry[];
  entries?: WindsurfMessageEntry[];
  createdAt?: string | number;
  updatedAt?: string | number;
  model?: string;
  modelId?: string;
  workspacePath?: string;
  projectPath?: string;
}

export interface ModelMapping {
  providerId: string;
  modelId: string;
}

export interface SessionAggregateCacheEntry {
  updatedAt: number;
  usageRows: SessionUsageData[];
  lastAccessed: number;
}
