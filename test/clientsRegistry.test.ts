import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import path from "path";
import {
  ClientsRegistry,
  INTERACTION_SERVER,
  type ToolCall,
  type AvailableTool,
} from "../src/clientsRegistry.js";

describe("ClientsRegistry (without external dependencies)", () => {
  let registry: ClientsRegistry;

  beforeEach(() => {
    registry = new ClientsRegistry();
  });

  it("getTools should return only the two default tools when no clients are registered", async () => {
    const tools = await registry.getTools();
    const names = tools.map((t) => t.function.name).sort();
    expect(names).toEqual(["ask_question", "task_complete"]);

    // Verify clientName for each default tool is INTERACTION_SERVER
    tools.forEach((t) => {
      expect(t.clientName).toBe(INTERACTION_SERVER);
      expect(t.type).toBe("function");
      expect(typeof t.function.name).toBe("string");
      expect(typeof t.function.parameters).toBe("object");
    });
  });

  it("register should throw when given an unsupported transport type", async () => {
    await expect(
      registry.register("invalid-transport", "some-client", "cmd", ["arg"], {
        PATH: "",
      })
    ).rejects.toThrow("Unsupported transport type: invalid-transport");
  });

  it("callTool should throw if requesting a non-existent tool", async () => {
    const missingCall: ToolCall = {
      function: {
        name: "nonexistent_tool",
        arguments: "{}",
      },
    };

    // No clients, so no tool by this name
    await expect(registry.callTool(missingCall)).rejects.toThrow(
      'Tool "nonexistent_tool" not found among registered clients.'
    );
  });
});

const HELLO_SERVER_PATH = path.resolve(
  __dirname,
  "fixtures/helloWorldServer.js"
);

describe("ClientsRegistry with HelloWorld MCP server", () => {
  let registry: ClientsRegistry;

  beforeAll(async () => {
    registry = new ClientsRegistry();

    await registry.register(
      "stdio",
      "hello-world-client",
      "node",
      [HELLO_SERVER_PATH],
      { PATH: process.env.PATH! }
    );

    // Give the server a brief moment to initialize and announce its tools.
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('getTools should include the "hello-world" tool', async () => {
    const tools = await registry.getTools();

    // Find the entry for our hello-world tool.
    const helloTool = tools.find(
      (t) => t.function.name === "hello-world"
    ) as AvailableTool;
    expect(helloTool).toBeDefined();
    expect(helloTool.clientName).toBe("hello-world-client");
    expect(helloTool.type).toBe("function");

    // Verify its parameter schema allows a "name" string.
    const params = helloTool.function.parameters;
    expect(params).toHaveProperty("type", "object");
    expect(params).toHaveProperty("properties");
    expect(params.properties).toHaveProperty("name");
    expect(params.properties.name).toHaveProperty("type", "string");
  });

  it('callTool with no "name" should return "Hello World!"', async () => {
    const toolCall: ToolCall = {
      function: {
        name: "hello-world",
        arguments: "{}",
      },
    };

    const result = await registry.callTool(toolCall);
    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBe(true);

    const firstPart = result.content[0];
    expect(firstPart).toHaveProperty("type", "text");
    expect(firstPart).toHaveProperty("text", "Hello World!");
  });

  it('callTool with a "name" parameter should include it in the greeting', async () => {
    const toolCall: ToolCall = {
      function: {
        name: "hello-world",
        arguments: JSON.stringify({ name: "Alice" }),
      },
    };

    const result = await registry.callTool(toolCall);
    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBe(true);

    const firstPart = result.content[0];
    expect(firstPart).toHaveProperty("type", "text");
    expect(firstPart).toHaveProperty("text", "Hello World Alice!");
  });
});
