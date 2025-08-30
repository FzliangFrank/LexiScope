import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { v4 as uuidv4 } from 'uuid';
import { Memory, ChatRequest, ChatResponse, MemoryRequest, SearchRequest } from './types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Initialize Weaviate client
const weaviateClient: WeaviateClient = weaviate.client({
  scheme: 'http',
  host: process.env.WEAVIATE_URL?.replace('http://', '') || 'localhost:8080',
});

// Simplified Memory Manager for hackathon
class SimpleMemoryManager {
  private client: WeaviateClient;
  private openai: OpenAI;
  private className = 'HackathonMemory';

  constructor(client: WeaviateClient, openaiClient: OpenAI) {
    this.client = client;
    this.openai = openaiClient;
  }

  async initSchema(): Promise<void> {
    try {
      const exists = await this.client.schema.exists(this.className).do();
      
      if (!exists) {
        await this.client.schema
          .classCreator()
          .withClass({
            class: this.className,
            description: 'Simple memory storage for hackathon',
            vectorizer: 'none',
            properties: [
              { name: 'content', dataType: ['text'] },
              { name: 'timestamp', dataType: ['date'] },
              { name: 'userId', dataType: ['string'] },
              { name: 'conversationId', dataType: ['string'] },
              { name: 'memoryType', dataType: ['string'] },
              { name: 'importance', dataType: ['number'] },
            ],
          })
          .do();
        console.log('✅ Memory schema initialized');
      }
    } catch (error) {
      console.error('❌ Schema init error:', error);
    }
  }

  async storeMemory(
    content: string, 
    userId: string, 
    conversationId: string, 
    memoryType: Memory['memoryType'] = 'context', 
    importance = 0.5
  ): Promise<string> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      const memoryId = uuidv4();
      
      await this.client.data
        .creator()
        .withClassName(this.className)
        .withId(memoryId)
        .withProperties({
          content,
          timestamp: new Date().toISOString(),
          userId,
          conversationId,
          memoryType,
          importance,
        })
        .withVector(embedding)
        .do();

      return memoryId;
    } catch (error) {
      console.error('❌ Store memory error:', error);
      throw error;
    }
  }

  async searchMemories(query: string, userId: string, limit = 5): Promise<Memory[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields('content timestamp userId conversationId memoryType importance _additional { id distance }')
        .withNearVector({ vector: queryEmbedding, distance: 0.7 })
        .withWhere({ path: ['userId'], operator: 'Equal', valueString: userId })
        .withLimit(limit)
        .do();

      return result.data.Get[this.className] || [];
    } catch (error) {
      console.error('❌ Search error:', error);
      return [];
    }
  }

  async getAllMemories(userId: string): Promise<Memory[]> {
    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields('content timestamp userId conversationId memoryType importance _additional { id }')
        .withWhere({ path: ['userId'], operator: 'Equal', valueString: userId })
        .withLimit(50) // Limit for hackathon
        .do();

      return result.data.Get[this.className] || [];
    } catch (error) {
      console.error('❌ Get memories error:', error);
      return [];
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
}

// Simplified Chat Agent
class SimpleChatAgent {
  constructor(
    private openai: OpenAI,
    private memoryManager: SimpleMemoryManager
  ) {}

  async generateResponse(
    message: string, 
    userId: string, 
    conversationId: string, 
    selectedMemories: Memory[] = []
  ): Promise<ChatResponse> {
    try {
      // Get relevant memories if none selected
      let relevantMemories = selectedMemories;
      if (selectedMemories.length === 0) {
        relevantMemories = await this.memoryManager.searchMemories(message, userId, 3);
      }

      // Build context
      const memoryContext = relevantMemories
        .map(memory => `Memory: ${memory.content}`)
        .join('\n');

      const systemPrompt = `You are a helpful AI assistant. ${memoryContext ? `\n\nRelevant memories:\n${memoryContext}` : ''}`;

      // Generate response
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500, // Shorter for demo
      });

      const assistantResponse = response.choices[0].message.content || '';

      // Store conversation as memory
      await this.memoryManager.storeMemory(
        `User: ${message}\nAssistant: ${assistantResponse}`,
        userId,
        conversationId
      );

      return {
        response: assistantResponse,
        usedMemories: relevantMemories,
      };
    } catch (error) {
      console.error('❌ Chat error:', error);
      throw error;
    }
  }
}

// Initialize services
const memoryManager = new SimpleMemoryManager(weaviateClient, openai);
const chatAgent = new SimpleChatAgent(openai, memoryManager);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/memories/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const memories = await memoryManager.getAllMemories(userId);
    res.json(memories);
  } catch (error) {
    console.error('❌ Get memories error:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, conversationId, selectedMemories = [] }: ChatRequest = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId required' });
    }

    const result = await chatAgent.generateResponse(
      message,
      userId,
      conversationId || uuidv4(),
      selectedMemories
    );

    res.json(result);
  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    res.status(500).json({ error: 'Chat failed' });
  }
});

app.post('/api/memories', async (req, res) => {
  try {
    const { content, userId, conversationId, memoryType, importance }: MemoryRequest = req.body;

    if (!content || !userId) {
      return res.status(400).json({ error: 'Content and userId required' });
    }

    const memoryId = await memoryManager.storeMemory(
      content,
      userId,
      conversationId || uuidv4(),
      memoryType,
      importance
    );

    res.json({ memoryId, success: true });
  } catch (error) {
    console.error('❌ Store memory error:', error);
    res.status(500).json({ error: 'Failed to store memory' });
  }
});

app.post('/api/memories/search', async (req, res) => {
  try {
    const { query, userId, limit = 10 }: SearchRequest = req.body;

    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId required' });
    }

    const memories = await memoryManager.searchMemories(query, userId, limit);
    res.json(memories);
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Start server
async function startServer() {
  try {
    await memoryManager.initSchema();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`🧠 Weaviate: ${process.env.WEAVIATE_URL || 'http://localhost:8080'}`);
    });
  } catch (error) {
    console.error('❌ Server start failed:', error);
    process.exit(1);
  }
}

startServer();
