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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  usedMemories?: Memory[];
  attachedMemories?: Memory[]; // Memories attached by user to this message
}

export interface ChatResponse {
  response: string;
  usedMemories: Memory[];
}

export interface DraggedMemory {
  memory: Memory;
  position: { x: number; y: number };
}
