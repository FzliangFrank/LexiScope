'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Memory } from '../types';
import { Clock, Brain, Star } from 'lucide-react';

interface MemoryBubbleProps {
  memory: Memory;
  onDragStart?: (memory: Memory) => void;
  onDragEnd?: () => void;
  isSelected?: boolean;
  onClick?: (memory: Memory) => void;
}

export function MemoryBubble({ 
  memory, 
  onDragStart, 
  onDragEnd, 
  isSelected = false,
  onClick 
}: MemoryBubbleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMemoryTypeIcon = () => <Brain className="w-3 h-3" />;
  const getMemoryTypeColor = () => 'from-memory-400 to-memory-600';

  const truncateContent = (content: string, maxLength = 50) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="relative">
      <motion.div
        className={`
          memory-bubble inline-flex items-center gap-2 text-sm font-medium select-none
          ${isSelected ? 'ring-2 ring-white ring-opacity-50' : ''}
          bg-gradient-to-r ${getMemoryTypeColor()}
          ${isDragging ? 'dragging' : ''}
        `}
        draggable={true}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onDragStart={(e) => {
          setIsDragging(true);
          onDragStart?.(memory);
          // Set drag data for HTML5 drag and drop
          if (e.dataTransfer) {
            e.dataTransfer.setData('application/json', JSON.stringify(memory));
            e.dataTransfer.effectAllowed = 'copy';
          }
        }}
        onDragEnd={() => {
          setIsDragging(false);
          onDragEnd?.();
        }}
        onClick={() => onClick?.(memory)}
        onHoverStart={() => setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
        animate={{
          y: isDragging ? -5 : 0,
          boxShadow: isDragging 
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {getMemoryTypeIcon()}
        <span>{truncateContent(memory.content)}</span>
      </motion.div>

      <AnimatePresence>
        {showTooltip && !isDragging && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
          >
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
              <div className="font-medium mb-1">{memory.memoryType.toUpperCase()}</div>
              <div className="mb-2">{memory.content}</div>
              <div className="text-gray-300 text-xs flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {formatTimestamp(memory.timestamp)}
              </div>
              {/* Tooltip arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
