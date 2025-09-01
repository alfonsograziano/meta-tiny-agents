import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RAG } from "./rag.js";
import { OpenAIEmbedder } from "./embedders/OpenAIEmbedder.ts";
import { PostgresVectorStore } from "./storage/PostgresVectorStore.ts";
import { Pool } from "pg";
import { TextAdapter } from "./adapters/TextAdapter.ts";
import { PdfAdapter } from "./adapters/PdfAdapter.ts";

const server = new McpServer(
  {
    name: "RAG",
    version: "1.0.0",
    description: "RAG server",
  },
  {
    capabilities: {
      logging: {},
      tools: {},
    },
  }
);

const rag = new RAG({
  logsAllowed: false, // Set to false as with MCP you cannot log on STDOUT
  embedder: new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY ?? "" }),
  filesystemIndexing: {
    enabled: true,
    workspaceDir: process.env.DOCS_DIR ?? "",
    adapters: [new TextAdapter(), new PdfAdapter()],
  },
  vectorStore: new PostgresVectorStore(
    new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "password",
      database: process.env.POSTGRES_DB ?? "ragdb",
    })
  ),
  textSplitter: {
    strategy: "recursive-character-chunker",
    options: {
      chunkSize: 500,
      chunkOverlapPercentage: 10,
    },
  },
});
// Schemas for tool inputs
export const retrieveMemorySchema = {
  query: z
    .string()
    .describe(
      "The search query used to retrieve relevant memories from the knowledge base"
    ),
  limit: z
    .number()
    .default(5)
    .describe("The maximum number of results to return"),
};

export const storeMemorySchema = {
  memory: z
    .string()
    .describe(
      "The memory or text snippet to store in the knowledge base for future retrieval"
    ),
};

// Configure server tools and resources
server.tool(
  "retrieve_memory",
  "Search the knowledge base to retrieve stored memories relevant to a query",
  retrieveMemorySchema,
  async (params) => {
    const { query, limit } = params;
    const results = await rag.query(query, limit);
    return {
      content: results.map((result) => ({
        type: "text",
        text: result.content,
      })),
    };
  }
);

server.tool(
  "store_memory",
  "Store a new memory in the knowledge base so it can be retrieved later",
  storeMemorySchema,
  async (params) => {
    const { memory } = params;
    await rag.indexText(memory);
    return {
      content: [{ type: "text", text: "✅ Memory stored successfully." }],
    };
  }
);

server.connect(new StdioServerTransport());
