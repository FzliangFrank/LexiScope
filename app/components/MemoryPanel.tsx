'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Memory } from '../types';
import { MemoryBubble } from './MemoryBubble';
import { Search, RefreshCw, Filter, X } from 'lucide-react';

interface MemoryPanelProps {
  memories: Memory[];
  selectedMemories: Memory[];
  onMemorySelect: (memory: Memory) => void;
  onMemoryDeselect: (memory: Memory) => void;
  onDragStart: (memory: Memory) => void;
  onDragEnd: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function MemoryPanel({
  memories,
  selectedMemories,
  onMemorySelect,
  onMemoryDeselect,
  onDragStart,
  onDragEnd,
  isLoading = false,
  onRefresh,
}: MemoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMemories = memories
    .filter(memory => {
      return searchQuery === '' || 
        memory.content.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleMemoryClick = (memory: Memory) => {
    const isSelected = selectedMemories.some(m => m._additional.id === memory._additional.id);
    if (isSelected) {
      onMemoryDeselect(memory);
    } else {
      onMemorySelect(memory);
    }
  };

  const clearSelectedMemories = () => {
    selectedMemories.forEach(memory => onMemoryDeselect(memory));
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Memory Bank</h2>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh memories"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>



        {/* Selected memories count */}
        {selectedMemories.length > 0 && (
          <div className="flex items-center justify-between bg-primary-50 rounded-lg p-3">
            <span className="text-sm text-primary-700">
              {selectedMemories.length} selected
            </span>
            <button
              onClick={clearSelectedMemories}
              className="text-primary-600 hover:text-primary-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        <AnimatePresence>
          {filteredMemories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-gray-500 py-8"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading memories...
                </div>
              ) : searchQuery ? (
                'No memories match your search'
              ) : (
                'No memories yet. Start chatting to create some!'
              )}
            </motion.div>
          ) : (
            filteredMemories.map((memory, index) => (
              <motion.div
                key={memory._additional.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="memory-container"
              >
                <MemoryBubble
                  memory={memory}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onClick={handleMemoryClick}
                  isSelected={selectedMemories.some(m => m._additional.id === memory._additional.id)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{filteredMemories.length} memories</span>
          <span>Drag to attach to chat</span>
        </div>
      </div>
    </div>
  );
}
