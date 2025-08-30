#!/bin/bash

echo "🚀 LexiScope Hackathon Setup"
echo "=============================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please edit .env and add your OpenAI API key!"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start Weaviate
echo "🗄️  Starting Weaviate database..."
docker-compose up -d

# Wait for Weaviate to be ready
echo "⏳ Waiting for Weaviate to start..."
sleep 10

# Check if Weaviate is running
if curl -s http://localhost:8080/v1/meta > /dev/null; then
    echo "✅ Weaviate is running!"
else
    echo "❌ Weaviate failed to start. Check Docker."
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OpenAI API key"
echo "2. Run 'npm run server' in one terminal"
echo "3. Run 'npm run dev' in another terminal"
echo "4. Open http://localhost:3000"
echo ""
echo "Happy hacking! 🚀"
