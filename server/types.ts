export interface Memory {
  content: string;
  timestamp: string;
  userId: string;
  conversationId: string;
  memoryType: 'fact' | 'preference' | 'context';
  importance: number;
  _additional: {
    id: string;
    distance?: number;
  };
}

export interface ChatRequest {
  message: string;
  userId: string;
  conversationId?: string;
  selectedMemories?: Memory[];
}

export interface ChatResponse {
  response: string;
  usedMemories: Memory[];
}

export interface MemoryRequest {
  content: string;
  userId: string;
  conversationId?: string;
  memoryType?: 'fact' | 'preference' | 'context';
  importance?: number;
}

export interface SearchRequest {
  query: string;
  userId: string;
  limit?: number;
}
