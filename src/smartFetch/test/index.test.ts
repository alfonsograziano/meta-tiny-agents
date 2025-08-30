import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";

describe("smart_fetch via MCP client", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ name: "node_js_sandbox_test", version: "1.0.0" });

    await client.connect(
      new StdioClientTransport({
        command: "npm",
        args: ["run", "start-smart-fetch-mcp"],
        cwd: "../../",
      })
    );
  }, 200_000);

  it("should fetch the data from the web", async () => {
    const result = (await client.callTool({
      name: "smart_fetch",
      arguments: {
        urls: [
          "https://en.wikipedia.org/wiki/Artificial_intelligence",
          "https://www.rottentomatoes.com/m/treasure_planet",
        ],
      },
    })) as {
      content: Array<{ type: string; text: string }>;
      structuredContent: { results: Array<{ markdown: string }> };
    };

    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content[0]).toMatchObject({
      type: "text",
    });
    expect(result.content[0].text).toContain("Artificial intelligence");
    expect(result.structuredContent.results[0].markdown).toContain(
      "Artificial intelligence"
    );

    expect(result.content[1].text).toContain("Treasure Planet");
  });
}, 200_000);
