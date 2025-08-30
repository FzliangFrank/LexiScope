import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import weaviate, { WeaviateClient, vectors } from 'weaviate-client';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Memory, ChatRequest, ChatResponse, MemoryRequest, SearchRequest } from './types';
import { RealtimeAgent } from './realtime-agent';

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
export class SimpleMemoryManager {
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

  async extractConceptualMemories(
    userMessage: string, 
    assistantResponse: string, 
    userId: string, 
    conversationId: string
  ): Promise<void> {
    try {
      const extractionPrompt = `Analyze this conversation and extract abstract concepts, entities, topics, and key information that would be useful for future conversations. Focus on extracting conceptual knowledge rather than the literal conversation.

User: "${userMessage}"
Assistant: "${assistantResponse}"

Extract and return a JSON array of conceptual memories. Each memory should be:
1. Abstract concepts (like "london", "bagel", "food", "travel")
2. Entities (like "SF 49ers", "NFL", "American football")  
3. Topics of interest (like "sports", "restaurants", "technology")
4. Factual information (like "user likes Italian food", "user lives in NYC")
5. Preferences (like "prefers morning workouts", "interested in AI")

CRITICAL: Return ONLY a valid JSON array, no explanations, no markdown, no extra text. Just the JSON array:

[
  {"concept": "london", "type": "location", "importance": 0.8},
  {"concept": "bagels", "type": "food", "importance": 0.7},
  {"concept": "restaurant recommendations", "type": "preference", "importance": 0.6}
]

Max 5 concepts. Return only the JSON array.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.3,
        max_tokens: 500,
      });

      const extractedText = response.choices[0].message.content?.trim();
      if (!extractedText) return;

      // Parse the JSON response (handle markdown code blocks)
      let concepts: Array<{concept: string, type: string, importance: number}>;
      try {
        // Clean the response - remove markdown code blocks and extra text
        let cleanedText = extractedText;
        
        // Remove markdown code blocks
        cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Find JSON array in the response
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedText = jsonMatch[0];
        }
        
        concepts = JSON.parse(cleanedText);
        
        // Validate that it's an array
        if (!Array.isArray(concepts)) {
          console.error('❌ Extracted concepts is not an array');
          return;
        }
      } catch (parseError) {
        console.error('❌ Failed to parse concept extraction:', parseError);
        console.error('❌ Raw response:', extractedText);
        
        // Fallback: create simple concepts from the user message
        const words = userMessage.toLowerCase().split(' ').filter(word => word.length > 3);
        concepts = words.slice(0, 3).map(word => ({
          concept: word,
          type: 'context',
          importance: 0.5
        }));
        console.log('⚠️ Using fallback concept extraction');
      }

      // Check for existing similar memories to avoid duplicates
      const existingMemories = await this.getAllMemories(userId);
      
      // Store each concept as a separate memory (with deduplication)
      for (const conceptData of concepts) {
        if (conceptData.concept && conceptData.concept.trim()) {
          const conceptText = conceptData.concept.trim().toLowerCase();
          
          // Check if we already have a similar memory
          const isDuplicate = existingMemories.some(existing => 
            existing.content.toLowerCase() === conceptText ||
            existing.content.toLowerCase().includes(conceptText) ||
            conceptText.includes(existing.content.toLowerCase())
          );
          
          if (!isDuplicate) {
            await this.storeMemory(
              conceptData.concept.trim(),
              userId,
              conversationId,
              this.determineMemoryType(conceptData.type),
              conceptData.importance || 0.5
            );
            console.log(`✅ Stored new conceptual memory: "${conceptData.concept}"`);
          } else {
            console.log(`⚠️ Skipped duplicate memory: "${conceptData.concept}"`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Concept extraction error:', error);
      // Don't throw - this is a nice-to-have feature
    }
  }

  private determineMemoryType(conceptType: string): Memory['memoryType'] {
    const typeMapping: Record<string, Memory['memoryType']> = {
      'preference': 'preference',
      'fact': 'fact',
      'location': 'fact',
      'person': 'fact',
      'entity': 'fact',
      'topic': 'context',
      'concept': 'context',
      'interest': 'preference',
    };
    
    return typeMapping[conceptType.toLowerCase()] || 'context';
  }

  async cleanupDuplicateMemories(userId: string): Promise<void> {
    try {
      const memories = await this.getAllMemories(userId);
      const seen = new Set<string>();
      const duplicateIds: string[] = [];

      // Find duplicates (case-insensitive)
      for (const memory of memories) {
        const normalizedContent = memory.content.toLowerCase().trim();
        if (seen.has(normalizedContent)) {
          duplicateIds.push(memory._additional.id);
        } else {
          seen.add(normalizedContent);
        }
      }

      // Delete duplicates from Weaviate
      if (duplicateIds.length > 0) {
        const collection = this.client.collections.use(this.className);
        for (const id of duplicateIds) {
          try {
            await collection.data.deleteById(id);
          } catch (error) {
            console.error(`❌ Failed to delete duplicate memory ${id}:`, error);
          }
        }
        console.log(`✅ Cleaned up ${duplicateIds.length} duplicate memories`);
      }
    } catch (error) {
      console.error('❌ Cleanup duplicates error:', error);
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
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500, // Shorter for demo
      });

      const assistantResponse = response.choices[0].message.content || '';

      // Extract and store conceptual memories instead of literal conversation
      await this.memoryManager.extractConceptualMemories(
        message,
        assistantResponse,
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
let realtimeAgent: RealtimeAgent;

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

app.post('/api/memories/cleanup/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    await memoryManager.cleanupDuplicateMemories(userId);
    res.json({ success: true, message: 'Duplicates cleaned up' });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Realtime chat endpoints
app.post('/api/realtime/session', async (req, res) => {
  try {
    const { userId, selectedMemories = [] } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const sessionId = await realtimeAgent.createSession(userId, selectedMemories);
    res.json({ sessionId });
  } catch (error) {
    console.error('❌ Create realtime session error:', error);
    res.status(500).json({ error: 'Failed to create realtime session' });
  }
});

app.post('/api/realtime/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message required' });
    }

    await realtimeAgent.sendMessage(sessionId, message);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Send realtime message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/realtime/update-memories', async (req, res) => {
  try {
    const { sessionId, selectedMemories = [] } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    await realtimeAgent.updateSessionMemories(sessionId, selectedMemories);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Update realtime memories error:', error);
    res.status(500).json({ error: 'Failed to update memories' });
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
    realtimeAgent = new RealtimeAgent(memoryManager);

    // Initialize schema
    await memoryManager.initSchema();
    
    // Create HTTP server for both Express and WebSocket
    const server = createServer(app);
    
    // Create WebSocket server for realtime communication
    const wss = new WebSocketServer({ server, path: '/realtime' });
    
    wss.on('connection', (ws, req) => {
      console.log('🔌 New WebSocket connection');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'join_session' && message.sessionId) {
            // Set up event handlers for this session
            realtimeAgent.setupEventHandlers(message.sessionId, (eventData) => {
              ws.send(JSON.stringify(eventData));
            });
            
            ws.send(JSON.stringify({ type: 'joined', sessionId: message.sessionId }));
          }
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
        }
      });
      
      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
      });
    });
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`🧠 Weaviate: ${process.env.WEAVIATE_URL || 'http://localhost:8080'}`);
      console.log(`⚡ Realtime WebSocket: ws://localhost:${PORT}/realtime`);
    });
  } catch (error) {
    console.error('❌ Server start failed:', error);
    process.exit(1);
  }
}

startServer();
