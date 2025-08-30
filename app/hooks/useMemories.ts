'use client';

import { useState, useEffect, useCallback } from 'react';
import { Memory } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useMemories(userId: string) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: Memory[] = await response.json();
      setMemories(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch memories';
      setError(errorMessage);
      console.error('Error fetching memories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const searchMemories = useCallback(async (query: string, limit = 10): Promise<Memory[]> => {
    if (!userId || !query.trim()) return [];

    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          userId,
          limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: Memory[] = await response.json();
      return data;
    } catch (err) {
      console.error('Error searching memories:', err);
      return [];
    }
  }, [userId]);

  const storeMemory = useCallback(async (
    content: string,
    conversationId: string,
    memoryType: Memory['memoryType'] = 'context',
    importance = 0.5
  ) => {
    if (!userId || !content.trim()) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          userId,
          conversationId,
          memoryType,
          importance,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Refresh memories after storing a new one
      await fetchMemories();
      
      return data.memoryId;
    } catch (err) {
      console.error('Error storing memory:', err);
      return null;
    }
  }, [userId, fetchMemories]);

  // Fetch memories on component mount and when userId changes
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  return {
    memories,
    isLoading,
    error,
    fetchMemories,
    searchMemories,
    storeMemory,
  };
}
