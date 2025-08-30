'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ChatMessage as ChatMessageType } from '../types';
import { User, Bot, Brain } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-primary-500' : 'bg-gray-600'}
      `}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`
          chat-message ${isUser ? 'user' : 'assistant'}
          ${isUser ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-800'}
        `}>
          <div className="whitespace-pre-wrap">{message.content}</div>
          
          {/* Used memories indicator */}
          {!isUser && message.usedMemories && message.usedMemories.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Brain className="w-3 h-3" />
                <span>Used {message.usedMemories.length} memory(s)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {message.usedMemories.map((memory, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 bg-memory-100 text-memory-800 text-xs rounded-full"
                    title={memory.content}
                  >
                    {memory.content.length > 20 
                      ? memory.content.substring(0, 20) + '...' 
                      : memory.content
                    }
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </motion.div>
  );
}
