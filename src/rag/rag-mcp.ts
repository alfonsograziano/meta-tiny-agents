import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RAG, type Env } from "./rag.js";

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

const rag = new RAG(process.env as Env, {
  logsAllowed: false, // Set to false as with MCP you cannot log on STDOUT
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
