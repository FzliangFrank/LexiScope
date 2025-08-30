import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import weaviate, { WeaviateClient, vectors } from 'weaviate-client';
import { v4 as uuidv4 } from 'uuid';
import { Memory, ChatRequest, ChatResponse, MemoryRequest, SearchRequest } from './types';

// Load environment variables
dotenv.config();

// Set OPENAI_APIKEY for Weaviate (without underscore)
if (process.env.OPENAI_API_KEY && !process.env.OPENAI_APIKEY) {
  process.env.OPENAI_APIKEY = process.env.OPENAI_API_KEY;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
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
      const exists = await this.client.collections.exists(this.className);
      
      if (exists) {
        // Delete existing collection to recreate with correct schema
        console.log('🔄 Deleting existing collection to fix schema...');
        await this.client.collections.delete(this.className);
      }
      
      await this.client.collections.create({
        name: this.className,
        properties: [
          { name: 'content', dataType: 'text' },
          { name: 'timestamp', dataType: 'text' },
          { name: 'userId', dataType: 'text' },
          { name: 'conversationId', dataType: 'text' },
          { name: 'memoryType', dataType: 'text' },
          { name: 'importance', dataType: 'number' },
        ],
        vectorizers: vectors.text2VecOpenAI({
          model: 'text-embedding-3-small',
        }),
      });
      console.log('✅ Memory schema initialized with correct types');
    } catch (error) {
      console.error('❌ Schema init error:', error);
      // For hackathon, continue even if schema init fails
      console.log('⚠️ Continuing without schema validation...');
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
      const memoryId = uuidv4();
      
      const collection = this.client.collections.use(this.className);
      await collection.data.insert({
        properties: {
          content,
          timestamp: new Date().toISOString(),
          userId,
          conversationId,
          memoryType,
          importance,
        },
      });

      console.log('✅ Memory stored in Weaviate');
      return memoryId;
    } catch (error) {
      console.error('❌ Store memory error:', error);
      throw error;
    }
  }

  async searchMemories(query: string, userId: string, limit = 5): Promise<Memory[]> {
    try {
      const collection = this.client.collections.use(this.className);
      const result = await collection.query.nearText(query, {
        limit: limit * 2, // Get more results to filter by userId
        returnMetadata: ['distance'],
      });

      // Filter by userId in the results
      const filteredResults = result.objects
        .filter((obj: any) => obj.properties.userId === userId)
        .slice(0, limit);

      return filteredResults.map((obj: any) => ({
        content: obj.properties.content,
        timestamp: obj.properties.timestamp,
        userId: obj.properties.userId,
        conversationId: obj.properties.conversationId,
        memoryType: obj.properties.memoryType,
        importance: obj.properties.importance,
        _additional: {
          id: obj.uuid,
          distance: obj.metadata?.distance,
        },
      }));
    } catch (error) {
      console.error('❌ Search error:', error);
      return [];
    }
  }

  async getAllMemories(userId: string): Promise<Memory[]> {
    try {
      const collection = this.client.collections.use(this.className);
      const result = await collection.query.fetchObjects({
        limit: 50, // Limit for hackathon
      });

      // Filter by userId in the results
      const filteredResults = result.objects
        .filter((obj: any) => obj.properties.userId === userId)
        .sort((a: any, b: any) => new Date(b.properties.timestamp).getTime() - new Date(a.properties.timestamp).getTime());

      return filteredResults.map((obj: any) => ({
        content: obj.properties.content,
        timestamp: obj.properties.timestamp,
        userId: obj.properties.userId,
        conversationId: obj.properties.conversationId,
        memoryType: obj.properties.memoryType,
        importance: obj.properties.importance,
        _additional: {
          id: obj.uuid,
        },
      }));
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

// Services will be initialized in startServer function
let memoryManager: SimpleMemoryManager;
let chatAgent: SimpleChatAgent;

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
    // Initialize Weaviate client with OpenAI API key
    const weaviateClient: WeaviateClient = await weaviate.connectToLocal({
      headers: {
        'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY!,
      },
    });

    // Initialize services
    memoryManager = new SimpleMemoryManager(weaviateClient, openai);
    chatAgent = new SimpleChatAgent(openai, memoryManager);

    // Initialize schema
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
