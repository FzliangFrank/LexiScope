# LexiScope - Hackathon Demo 🚀

A selective retrieval chat interface for GPT-4 with personalized memory bubbles! Built for hackathons with quick setup and impressive demos.

## ✨ Demo Features

- **🧠 Smart Memory**: Conversations auto-saved as draggable memory bubbles
- **🎯 Selective Context**: Drag specific memories to personalize responses  
- **⚡ Real-time Chat**: Smooth animations with Next.js + Framer Motion
- **🔍 Memory Search**: Find relevant memories instantly
- **🎨 Beautiful UI**: Modern gradient design perfect for demos

## 🏗️ Quick Architecture

```
Next.js Frontend ←→ TypeScript API ←→ Weaviate Vector DB
                         ↓
                    OpenAI GPT-4
```

## ⚡ Super Quick Setup

### Option 1: One-Command Setup
```bash
./setup.sh
```

### Option 2: Manual Setup (3 steps)

1. **Install & Configure**
   ```bash
   npm install
   cp env.example .env
   # Edit .env and add your OpenAI API key
   ```

2. **Start Services**
   ```bash
   docker-compose up -d  # Weaviate database
   npm run server        # Backend API
   ```

3. **Launch Demo**
   ```bash
   npm run dev          # Frontend
   # Open http://localhost:3000
   ```

**That's it! 🎉**

## 🎮 Demo Flow

### Perfect for Hackathon Demos!

1. **Start Chatting** - Type anything, watch memories auto-create
2. **See Memory Bubbles** - Purple bubbles appear in left sidebar  
3. **Drag & Drop Magic** - Drag bubbles to chat input for context
4. **Personalized Responses** - GPT uses your selected memories
5. **Search Memories** - Find specific conversations instantly

### Pro Demo Tips 💡
- Chat about different topics to build diverse memories
- Show the drag-and-drop interaction - it's impressive!
- Search for memories to demonstrate semantic similarity
- Highlight how responses change with/without memory context

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js + TypeScript, OpenAI SDK, Weaviate Client  
- **Database**: Weaviate Vector Database
- **AI**: OpenAI GPT-4 + Embeddings

## 🏆 Hackathon-Ready Features

- ⚡ **Quick Setup**: One command installation
- 🎨 **Demo-Perfect UI**: Smooth animations, beautiful gradients
- 🧠 **Impressive Tech**: Vector embeddings, semantic search
- 🎯 **Clear Value Prop**: Visual memory + personalized AI
- 📱 **Mobile Friendly**: Responsive design

## 🚀 Production Notes

For hackathon judging:
- All data stored locally (no external dependencies)
- Semantic memory search using vector embeddings
- Real-time drag-and-drop interactions
- TypeScript for type safety and better demos

## 🆘 Quick Fixes

**Weaviate won't start?**
```bash
docker-compose down && docker-compose up -d
```

**OpenAI errors?** 
- Check your API key in `.env`
- Ensure you have credits

**Frontend won't load?**
- Run `npm install` again
- Check both servers are running

---

**Built for hackathons** 🏆 **Ready to impress judges** ⚡ **Deploy in minutes** 🚀
