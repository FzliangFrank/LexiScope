'use client';

import { useState, useCallback } from 'react';
import { ChatMessage, Memory, ChatResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useChat(userId: string, onMemoriesUpdated?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    content: string, 
    selectedMemories: Memory[] = [],
    conversationId?: string
  ) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      attachedMemories: selectedMemories, // Store which memories were attached
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          userId,
          conversationId: conversationId || uuidv4(),
          selectedMemories,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        usedMemories: data.usedMemories,
      };

      // Debug logging for memory reactions
      console.log('💬 Assistant message created with usedMemories:', data.usedMemories?.length || 0);
      if (data.usedMemories && data.usedMemories.length > 0) {
        console.log('🧠 Used memories:', data.usedMemories.map(m => m.content));
      }

      setMessages(prev => [...prev, assistantMessage]);
      
      // Trigger memory refresh after successful response
      if (onMemoriesUpdated) {
        setTimeout(() => {
          onMemoriesUpdated();
        }, 1000); // Small delay to allow memory extraction to complete
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, onMemoriesUpdated]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
