# Tiny Agent

```
████████╗██╗███╗   ██╗██╗   ██╗     █████╗  ██████╗ ███████╗███╗   ██╗████████╗
╚══██╔══╝██║████╗  ██║╚██╗ ██╔╝    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
   ██║   ██║██╔██╗ ██║ ╚████╔╝     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║
   ██║   ██║██║╚██╗██║  ╚██╔╝      ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║
   ██║   ██║██║ ╚████║   ██║       ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║
   ╚═╝   ╚═╝╚═╝  ╚═══╝   ╚═╝       ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝
```

A lightweight, intelligent agent framework with built-in RAG capabilities, memory persistence, and powerful tool integration. Tiny Agent combines a server-client architecture with automatic file indexing and PostgreSQL vector storage for seamless AI-powered workflows.

## Features

- **🤖 Intelligent Agent**: LLM-powered agent with context-aware decision making
- **🔄 Server-Client Architecture**: Separate server and client processes for scalable deployment
- **📚 RAG System**: Automatic file indexing and retrieval with semantic search
- **💾 Memory Persistence**: Save and load agent memories using RAG and pgvector
- **🛠️ Built-in Tools**: Integrated MCP servers including code interpreter, Playwright, filesystem access, and smart web content fetching
- **🔧 Node.js Sandbox**: Safe code execution environment for dynamic tool creation
- **🌐 Smart Web Fetching**: LLM-optimized web content extraction with clean text conversion

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension
- OpenAI API key
- Docker

### Installation

```bash
npm install
```

### Configuration

1. Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your-key-here
```

2. Configure your agent in `agent.json`:
   Customize the params in the agent.json

3. Set up your database connection in `docker-compose.yml` or environment variables

### Running the Agent

Start the server:

```bash
npm run start-server
```

Start the client:

```bash
npm run start-client
```

## Architecture

### Server

The server handles:

- RAG operations and file indexing
- Memory storage and retrieval
- MCP server management
- Tool registry and execution

### Client

The client provides:

- User interaction interface
- Goal setting and task management
- Tool invocation and result handling
- Memory context management

## RAG System

Tiny Agent automatically indexes files in your workspace and provides semantic search capabilities:

- **Automatic Indexing**: Files are automatically processed and indexed
- **Multiple Formats**: Supports PDF, text, and other document types
- **Vector Search**: Uses pgvector for efficient similarity search
- **Context Retrieval**: Relevant information is automatically retrieved for agent tasks

## Memory System

Persist agent memories across sessions:

- **Memory Storage**: Save important information and context
- **Vector Embeddings**: Memories are stored as semantic vectors
- **Retrieval**: Automatically retrieve relevant memories for current tasks
- **Persistence**: Memories survive server restarts and are stored in PostgreSQL

## Built-in Tools

### Code Interpreter

- Execute Node.js code in a sandboxed environment
- Safe code execution with resource limits
- Dynamic tool creation capabilities

### Playwright Integration

- Web automation and scraping
- Browser control and interaction
- Screenshot and page analysis

### Filesystem Access

- File reading and writing
- Directory traversal
- File manipulation operations

### Smart Web Content Fetching

- Fetch and extract clean, LLM-optimized text content from webpages
- Automatic content cleaning using Mozilla's Readability parser
- Converts HTML to clean Markdown format
- Resolves relative links to absolute URLs
- Perfect for RAG systems and content analysis tasks

## Contributing

This is an experimental framework for exploring AI agent patterns. Contributions are welcome!

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
