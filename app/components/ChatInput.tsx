'use client';

import React, { useState, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Memory } from '../types';
import { Send, Paperclip, X } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string, selectedMemories: Memory[]) => void;
  attachedMemories: Memory[];
  onDetachMemory: (memory: Memory) => void;
  onAttachMemory?: (memory: Memory) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  attachedMemories,
  onDetachMemory,
  onAttachMemory,
  isLoading = false,
  placeholder = "Type your message...",
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!message.trim() || isLoading) return;
    
    onSendMessage(message.trim(), attachedMemories);
    setMessage('');
    
    // Clear attached memories after sending
    attachedMemories.forEach(memory => onDetachMemory(memory));
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const memoryData = e.dataTransfer.getData('application/json');
      if (memoryData && onAttachMemory) {
        const memory = JSON.parse(memoryData);
        onAttachMemory(memory);
        console.log('✅ Memory attached to chat input:', memory.content);
      }
    } catch (error) {
      console.error('❌ Failed to handle dropped memory:', error);
    }
  };

  const truncateMemoryContent = (content: string, maxLength = 30) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Attached memories */}
      <AnimatePresence>
        {attachedMemories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 border-b border-gray-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-medium">
                Attached Memories ({attachedMemories.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachedMemories.map((memory) => (
                <motion.div
                  key={memory._additional.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                >
                  <span>{truncateMemoryContent(memory.content)}</span>
                  <button
                    onClick={() => onDetachMemory(memory)}
                    className="text-green-600 hover:text-green-800 transition-colors"
                    title="Remove memory"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-4">
        <div
          className={`
            relative flex items-end gap-3 p-3 border rounded-lg transition-all duration-200
            ${isDragOver 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-gray-300 bg-white'
            }
            ${isLoading ? 'opacity-50' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drop zone indicator */}
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-50 rounded-lg border-2 border-dashed border-primary-500">
              <div className="text-primary-600 font-medium">
                Drop memory here to attach
              </div>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 resize-none border-0 focus:ring-0 focus:outline-none bg-transparent min-h-[40px] max-h-[120px]"
            rows={1}
          />

          {/* Send button */}
          <motion.button
            onClick={handleSubmit}
            disabled={!message.trim() || isLoading}
            className={`
              flex-shrink-0 p-2 rounded-lg transition-all duration-200
              ${message.trim() && !isLoading
                ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
            whileHover={message.trim() && !isLoading ? { scale: 1.05 } : {}}
            whileTap={message.trim() && !isLoading ? { scale: 0.95 } : {}}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Helper text */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>Drag memories from the sidebar to attach them</span>
        </div>
      </div>
    </div>
  );
}
