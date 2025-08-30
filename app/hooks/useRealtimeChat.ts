'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Memory } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_BASE_URL = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');

interface RealtimeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export function useRealtimeChat(userId: string) {
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentResponseRef = useRef<string>('');

  // Create a new realtime session
  const createSession = useCallback(async (selectedMemories: Memory[] = []) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/realtime/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          selectedMemories,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSessionId(data.sessionId);

      // Connect to WebSocket
      const ws = new WebSocket(`${WS_BASE_URL}/realtime`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        
        // Join the session
        ws.send(JSON.stringify({
          type: 'join_session',
          sessionId: data.sessionId,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          handleRealtimeEvent(eventData);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError('WebSocket connection failed');
        setIsConnected(false);
      };

      return data.sessionId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
      setError(errorMessage);
      console.error('❌ Create session error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Handle realtime events from the server
  const handleRealtimeEvent = useCallback((eventData: any) => {
    switch (eventData.type) {
      case 'session_ready':
        console.log('✅ Realtime session ready');
        break;

      case 'text_delta':
        // Stream text deltas
        currentResponseRef.current += eventData.delta;
        
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            // Update the streaming message
            return prev.map((msg, index) => 
              index === prev.length - 1 
                ? { ...msg, content: currentResponseRef.current }
                : msg
            );
          } else {
            // Create new streaming message
            return [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: currentResponseRef.current,
              timestamp: new Date().toISOString(),
              isStreaming: true,
            }];
          }
        });
        break;

      case 'response_complete':
        // Finalize the streaming message
        currentResponseRef.current = '';
        setMessages(prev => 
          prev.map(msg => 
            msg.isStreaming 
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
        break;

      case 'error':
        console.error('❌ Realtime error:', eventData.error);
        setError(eventData.error);
        break;

      default:
        console.log('📨 Realtime event:', eventData.type);
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(async (message: string) => {
    if (!sessionId || !message.trim()) return;

    try {
      setError(null);
      
      // Add user message to UI immediately
      const userMessage: RealtimeMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);
      currentResponseRef.current = ''; // Reset for new response

      // Send message to realtime API
      const response = await fetch(`${API_BASE_URL}/api/realtime/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setError(errorMessage);
      console.error('❌ Send message error:', error);
    }
  }, [sessionId]);

  // Update session memories
  const updateMemories = useCallback(async (selectedMemories: Memory[]) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/realtime/update-memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          selectedMemories,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Update memories error:', error);
    }
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    currentResponseRef.current = '';
  }, []);

  return {
    messages,
    isConnected,
    isLoading,
    error,
    sessionId,
    createSession,
    sendMessage,
    updateMemories,
    clearMessages,
  };
}
