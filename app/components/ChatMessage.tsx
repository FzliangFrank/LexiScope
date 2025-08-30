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
          
          {/* Memory reactions - iMessage style (only on user messages) */}
          {isUser && message.attachedMemories && message.attachedMemories.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1 justify-end">
                {message.attachedMemories.map((memory, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="memory-reaction inline-flex items-center gap-1 px-2 py-1"
                    title={`Attached memory: ${memory.content}`}
                  >
                    <Brain className="w-2.5 h-2.5" />
                    <span>
                      {memory.content.length > 15 
                        ? memory.content.substring(0, 15) + '...' 
                        : memory.content
                      }
                    </span>
                  </motion.div>
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
