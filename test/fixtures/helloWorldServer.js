import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create a new MCP server named "HelloWorld"
const server = new McpServer({
  name: "HelloWorld",
  version: "1.0.0",
});

server.tool(
  "hello-world",
  {
    name: z
      .string()
      .optional()
      .describe("Optional name to include in the greeting"),
  },
  async ({ name }) => {
    const greeting = name ? `Hello World ${name}!` : "Hello World!";
    return {
      content: [{ type: "text", text: greeting }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
