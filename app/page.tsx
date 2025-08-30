'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Memory } from './types';
import { useChat } from './hooks/useChat';
import { useMemories } from './hooks/useMemories';
import { useRealtimeChat } from './hooks/useRealtimeChat';
import { MemoryPanel } from './components/MemoryPanel';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Brain, MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function ChatPage() {
  // User ID (in a real app, this would come from authentication)
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lexiscope-user-id') || (() => {
        const newId = uuidv4();
        localStorage.setItem('lexiscope-user-id', newId);
        return newId;
      })();
    }
    return uuidv4(); // Fallback for SSR
  });

  const [conversationId] = useState(() => uuidv4());
  const [selectedMemories, setSelectedMemories] = useState<Memory[]>([]);
  const [attachedMemories, setAttachedMemories] = useState<Memory[]>([]);
  const [draggedMemory, setDraggedMemory] = useState<Memory | null>(null);
  const [useRealtime, setUseRealtime] = useState(false); // Start with regular chat for stability

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hooks - order matters to avoid circular dependencies
  const { 
    memories, 
    isLoading: isMemoriesLoading, 
    error: memoriesError, 
    fetchMemories 
  } = useMemories(userId);
  
  const { messages: regularMessages, isLoading: isChatLoading, error: chatError, sendMessage, clearMessages } = useChat(userId, fetchMemories);
  const { 
    messages: realtimeMessages, 
    isConnected, 
    isLoading: isRealtimeLoading, 
    error: realtimeError,
    sessionId,
    createSession,
    sendMessage: sendRealtimeMessage,
    updateMemories: updateRealtimeMemories,
    clearMessages: clearRealtimeMessages,
  } = useRealtimeChat(userId, fetchMemories);

  // Use appropriate messages and loading states based on mode
  const messages = useRealtime ? realtimeMessages : regularMessages;
  const isLoading = useRealtime ? isRealtimeLoading : isChatLoading;
  const currentError = useRealtime ? realtimeError : chatError;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Memory selection handlers
  const handleMemorySelect = (memory: Memory) => {
    setSelectedMemories(prev => [...prev, memory]);
  };

  const handleMemoryDeselect = (memory: Memory) => {
    setSelectedMemories(prev => 
      prev.filter(m => m._additional.id !== memory._additional.id)
    );
  };

  // Drag and drop handlers
  const handleDragStart = (memory: Memory) => {
    setDraggedMemory(memory);
  };

  const handleDragEnd = () => {
    setDraggedMemory(null);
  };

  // Attach/detach memory handlers
  const handleAttachMemory = (memory: Memory) => {
    const isAlreadyAttached = attachedMemories.some(m => m._additional.id === memory._additional.id);
    
    if (!isAlreadyAttached) {
      console.log('✅ Attaching memory:', memory.content);
      setAttachedMemories(prev => [...prev, memory]);
    } else {
      console.log('⚠️ Memory already attached, skipping:', memory.content);
    }
  };

  const handleDetachMemory = (memory: Memory) => {
    setAttachedMemories(prev => 
      prev.filter(m => m._additional.id !== memory._additional.id)
    );
  };

  // Initialize realtime session when switching to realtime mode
  useEffect(() => {
    if (useRealtime && !sessionId && !isRealtimeLoading) {
      console.log('🔄 Creating realtime session...');
      createSession([]).catch((error) => {
        console.error('❌ Failed to create realtime session:', error);
      });
    }
  }, [useRealtime, sessionId, isRealtimeLoading, createSession]);

  // Update realtime memories when attached memories change
  useEffect(() => {
    if (useRealtime && isConnected && sessionId && attachedMemories.length > 0) {
      console.log('🔄 Updating realtime memories...');
      updateRealtimeMemories(attachedMemories);
    }
  }, [attachedMemories, isConnected, useRealtime, sessionId, updateRealtimeMemories]);

  // Chat handlers
  const handleSendMessage = async (message: string, memories: Memory[]) => {
    if (useRealtime) {
      await sendRealtimeMessage(message, memories);
    } else {
      await sendMessage(message, memories, conversationId);
    }
  };

  const handleClearChat = () => {
    if (useRealtime) {
      clearRealtimeMessages();
    } else {
      clearMessages();
    }
    setAttachedMemories([]);
    setSelectedMemories([]);
  };

  const handleToggleMode = () => {
    console.log('🔄 Toggling mode to:', !useRealtime ? 'Realtime' : 'Standard');
    setUseRealtime(!useRealtime);
    setAttachedMemories([]);
    setSelectedMemories([]);
  };

  // Error handling
  const hasError = currentError || memoriesError;
  const errorMessage = currentError || memoriesError;

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Memory Panel */}
      <div className="w-80 flex-shrink-0">
        <MemoryPanel
          memories={memories}
          selectedMemories={selectedMemories}
          onMemorySelect={handleMemorySelect}
          onMemoryDeselect={handleMemoryDeselect}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          isLoading={isMemoriesLoading}
          onRefresh={fetchMemories}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">LexiScope</h1>
                <p className="text-sm text-gray-500">Personalized AI Chat with Memory</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Mode toggle and status */}
              <div className="flex items-center gap-4">
                {/* Realtime mode toggle */}
                <button
                  onClick={handleToggleMode}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    useRealtime 
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ⚡ {useRealtime ? 'Realtime' : 'Standard'}
                </button>
                
                {/* Status indicators */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      hasError ? 'bg-red-500' : 
                      useRealtime ? (isConnected ? 'bg-green-500' : 'bg-yellow-500') : 
                      'bg-green-500'
                    }`} />
                    <span>
                      {hasError ? 'Error' : 
                       useRealtime ? (isConnected ? 'Realtime Active' : 'Connecting...') : 
                       'Standard Mode'}
                    </span>
                  </div>
                  <span>•</span>
                  <span>{memories.length} memories</span>
                </div>
              </div>

              {/* Clear chat button */}
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Clear Chat
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {hasError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border-b border-red-200 px-6 py-3"
            >
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Error: {errorMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gradient-to-r from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Welcome to LexiScope!
                </h3>
                <p className="text-gray-600 mb-4">
                  Experience real-time AI conversations with GPT-5 enhanced by your personal memory bank. 
                  Your conversations are remembered and used to personalize future interactions.
                </p>
                <div className="text-sm text-gray-500 space-y-1">
                  <div>💡 <strong>Tip:</strong> Drag memory bubbles from the sidebar to attach specific context</div>
                  <div>⚡ <strong>Realtime Mode:</strong> Experience streaming responses with OpenAI's Realtime API</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {/* Loading indicator */}
              {isChatLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 mb-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="flex-1">
                    <div className="chat-message assistant">
                      <div className="flex items-center gap-2">
                        <span>Thinking</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="flex-shrink-0">
          <ChatInput
            onSendMessage={handleSendMessage}
            attachedMemories={attachedMemories}
            onDetachMemory={handleDetachMemory}
            onAttachMemory={handleAttachMemory}
            isLoading={isLoading}
            placeholder="Type your message... (drag memories here to attach context)"
          />
        </div>
      </div>
    </div>
  );
}
