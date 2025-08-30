import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Memory } from './types';
import { SimpleMemoryManager } from './index';

interface RealtimeSession {
  id: string;
  ws: WebSocket;
  userId: string;
  conversationId: string;
  memoryManager: SimpleMemoryManager;
  lastUserMessage?: string;
}

interface ClientEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

interface ServerEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

export class RealtimeAgent {
  private sessions: Map<string, RealtimeSession> = new Map();
  private openaiWs: WebSocket | null = null;
  private memoryManager: SimpleMemoryManager;

  constructor(memoryManager: SimpleMemoryManager) {
    this.memoryManager = memoryManager;
  }

  async createSession(userId: string, selectedMemories: Memory[] = []): Promise<string> {
    const sessionId = uuidv4();
    const conversationId = uuidv4();

    // Connect to OpenAI Realtime API
    const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    return new Promise((resolve, reject) => {
      openaiWs.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API');

        // Build memory context from selected memories
        const memoryContext = selectedMemories.length > 0 
          ? selectedMemories.map(m => `- ${m.content}`).join('\n')
          : '';

        const systemPrompt = `You are a helpful AI assistant with access to the user's conversation history and memories.

${memoryContext ? `IMPORTANT CONTEXT - The user has specifically selected these memories as relevant to their questions:\n${memoryContext}\n\nUse this context to understand references like "he", "his", "they", "it", etc. If the user asks about "his record" and the context mentions "Ja'Marr Chase", then "his" refers to Ja'Marr Chase.` : ''}

Respond naturally and helpfully, using the provided context to resolve ambiguous references and provide personalized information. Keep responses concise and engaging.`;

        // Initialize session with text-only mode
        const sessionUpdate: ClientEvent = {
          type: 'session.update',
          session: {
            model: 'gpt-4o-realtime-preview-2024-10-01',
            modalities: ['text'], // Text only, no audio
            instructions: systemPrompt,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,
            },
            tools: [],
            tool_choice: 'auto',
            temperature: 0.7,
            max_response_output_tokens: 'inf',
          },
        };

        openaiWs.send(JSON.stringify(sessionUpdate));

        // Store session
        const session: RealtimeSession = {
          id: sessionId,
          ws: openaiWs,
          userId,
          conversationId,
          memoryManager: this.memoryManager,
        };

        this.sessions.set(sessionId, session);
        resolve(sessionId);
      });

      openaiWs.on('error', (error) => {
        console.error('❌ OpenAI Realtime connection error:', error);
        reject(error);
      });
    });
  }

  async sendMessage(sessionId: string, message: string, attachedMemories: Memory[] = []): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Store the user message for conceptual extraction later
    session.lastUserMessage = message;

    // Update session context with attached memories if provided
    if (attachedMemories.length > 0) {
      await this.updateSessionMemories(sessionId, attachedMemories);
    }

    // Create conversation item with user message
    const conversationItem: ClientEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: message,
          },
        ],
      },
    };

    session.ws.send(JSON.stringify(conversationItem));

    // Create response (text only)
    const responseCreate: ClientEvent = {
      type: 'response.create',
      response: {
        modalities: ['text'],
      },
    };

    session.ws.send(JSON.stringify(responseCreate));
  }

  setupEventHandlers(sessionId: string, onMessage: (data: any) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.ws.on('message', async (data: WebSocket.Data) => {
      try {
        const event: ServerEvent = JSON.parse(data.toString());
        
        switch (event.type) {
          case 'session.created':
            console.log('✅ Realtime session created');
            onMessage({ type: 'session_ready' });
            break;

          case 'response.text.delta':
            // Stream text deltas to client
            onMessage({
              type: 'text_delta',
              delta: event.delta,
            });
            break;

          case 'response.done':
            // Response completed, extract conceptual memories
            const response = event.response;
            if (response.output && response.output.length > 0) {
              const output = response.output[0];
              if (output.content && output.content.length > 0) {
                const textContent = output.content.find((c: any) => c.type === 'text');
                if (textContent && session.lastUserMessage) {
                  // Extract conceptual memories from the conversation
                  await session.memoryManager.extractConceptualMemories(
                    session.lastUserMessage,
                    textContent.text,
                    session.userId,
                    session.conversationId
                  );
                }
              }
            }

            onMessage({
              type: 'response_complete',
              response: event.response,
            });
            break;

          case 'error':
            console.error('❌ Realtime API error:', event);
            onMessage({
              type: 'error',
              error: event.error,
            });
            break;

          default:
            // Forward other events
            onMessage(event);
        }
      } catch (error) {
        console.error('❌ Error processing realtime event:', error);
        onMessage({
          type: 'error',
          error: 'Failed to process event',
        });
      }
    });
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ws.close();
      this.sessions.delete(sessionId);
      console.log(`✅ Closed realtime session: ${sessionId}`);
    }
  }

  // Update session with new memory context
  async updateSessionMemories(sessionId: string, selectedMemories: Memory[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const memoryContext = selectedMemories.length > 0 
      ? selectedMemories.map(m => `Memory: ${m.content}`).join('\n')
      : '';

    const systemPrompt = `You are a helpful AI assistant with access to the user's conversation history and memories. Use the provided memories to personalize your responses.

${memoryContext ? `Relevant memories:\n${memoryContext}\n` : ''}

Respond naturally and helpfully, incorporating relevant information from the memories when appropriate. Keep responses concise and engaging.`;

    const sessionUpdate: ClientEvent = {
      type: 'session.update',
      session: {
        instructions: systemPrompt,
      },
    };

    session.ws.send(JSON.stringify(sessionUpdate));
  }
}
