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

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js + TypeScript, OpenAI SDK, Weaviate Client  
- **Database**: Weaviate Vector Database
- **AI**: OpenAI realtime API, GPT-4o + Embeddings

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

