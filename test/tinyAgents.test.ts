// tests/tinyAgents.test.ts

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { TinyAgent, type TinyAgentRunResult } from "../src/tinyAgents.js";
import { OpenAI } from "openai";
import path from "path";

describe("TinyAgent with real ClientsRegistry (no external tools registered)", () => {
  let openaiMock: {
    chat: {
      completions: {
        create: Mock;
      };
    };
  };

  beforeEach(() => {
    // Mock the OpenAI client’s chat.completions.create method
    openaiMock = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
  });

  it("runs to completion when the LLM never requests a tool", async () => {
    // Arrange: LLM returns a single assistant message with no tool_calls
    openaiMock.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "All done, no tools needed.",
          },
        },
      ],
    });

    const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Just say hi." },
    ];

    const agent = new TinyAgent({});
    const result: TinyAgentRunResult = await agent.run({
      openai: openaiMock as unknown as OpenAI,
      baseMessages,
    });

    // Assert: exactly one LLM call, no toolCalls
    expect(result.llmCalls).toHaveLength(1);
    expect(result.toolCalls).toHaveLength(0);

    // Conversation should include the two base messages + assistant response
    expect(result.conversation).toHaveLength(3);
    expect(result.conversation[0]).toEqual(baseMessages[0]);
    expect(result.conversation[1]).toEqual(baseMessages[1]);
    const assistantMsg = result.conversation[2] as any;
    expect(assistantMsg.role).toBe("assistant");
    expect(assistantMsg.content).toBe("All done, no tools needed.");
  });

  it("throws if the LLM requests a non-existent tool", async () => {
    // Arrange: LLM returns a tool call for "nonexistent_tool"
    openaiMock.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call-123",
                function: {
                  name: "nonexistent_tool",
                  arguments: JSON.stringify({ foo: "bar" }),
                },
              },
            ],
          },
        },
      ],
    });

    const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Use a tool I haven't registered." },
    ];

    const agent = new TinyAgent({});

    // Act & Assert: run should reject because "nonexistent_tool" is not in ClientsRegistry
    await expect(
      agent.run({
        openai: openaiMock as unknown as OpenAI,
        baseMessages,
      })
    ).rejects.toThrow(/Tool "nonexistent_tool" not found/);
  });
});

describe("TinyAgent with real ClientsRegistry (with external tools registered)", () => {
  let openaiMock: {
    chat: {
      completions: {
        create: Mock;
      };
    };
  };

  beforeEach(() => {
    // Mock the OpenAI client’s chat.completions.create method
    openaiMock = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
  });

  it("runs to completion when the LLM never requests a tool", async () => {
    // Arrange: LLM returns a single assistant message with no tool_calls
    openaiMock.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "All done, no tools needed.",
          },
        },
      ],
    });

    const HELLO_SERVER_PATH = path.resolve(
      __dirname,
      "fixtures/helloWorldServer.js"
    );

    const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Just say hi." },
    ];

    const agent = new TinyAgent({});
    await agent
      .getClientsRegistry()
      .register("stdio", "hello-world-client", "node", [HELLO_SERVER_PATH], {
        PATH: process.env.PATH!,
      });
    const result: TinyAgentRunResult = await agent.run({
      openai: openaiMock as unknown as OpenAI,
      baseMessages,
    });

    // Assert: exactly one LLM call, no toolCalls
    expect(result.llmCalls).toHaveLength(1);
    expect(result.toolCalls).toHaveLength(0);

    // Conversation should include the two base messages + assistant response
    expect(result.conversation).toHaveLength(3);
    expect(result.conversation[0]).toEqual(baseMessages[0]);
    expect(result.conversation[1]).toEqual(baseMessages[1]);
    const assistantMsg = result.conversation[2] as any;
    expect(assistantMsg.role).toBe("assistant");
    expect(assistantMsg.content).toBe("All done, no tools needed.");
  });

  it("runs to completion when the LLM requests a tool which is available in the registered clients", async () => {
    // Arrange: LLM first returns a tool call, then returns a final assistant message
    openaiMock.chat.completions.create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  function: {
                    name: "hello-world",
                    arguments: JSON.stringify({}),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Final answer after tool.",
            },
          },
        ],
      });

    const HELLO_SERVER_PATH = path.resolve(
      __dirname,
      "fixtures/helloWorldServer.js"
    );

    const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Call the hello-world tool." },
    ];

    const agent = new TinyAgent({});
    // Register the "hello-world" tool
    await agent
      .getClientsRegistry()
      .register("stdio", "hello-world", "node", [HELLO_SERVER_PATH], {
        PATH: process.env.PATH!,
      });

    // Act
    const result: TinyAgentRunResult = await agent.run({
      openai: openaiMock as unknown as OpenAI,
      baseMessages,
    });

    // Assert: two LLM calls (one for tool request, one for final answer)
    expect(result.llmCalls).toHaveLength(2);
    // One tool call should have been executed
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].toolName).toBe("hello-world");
    expect(result.toolCalls[0].params).toEqual({});

    // Conversation should include:
    //  - the two base messages,
    //  - the assistant message with the tool call,
    //  - the tool response message,
    //  - the final assistant message
    expect(result.conversation).toHaveLength(5);
    expect(result.conversation[0]).toEqual(baseMessages[0]);
    expect(result.conversation[1]).toEqual(baseMessages[1]);

    const toolRequestMsg = result.conversation[2] as any;
    expect(toolRequestMsg.role).toBe("assistant");
    expect(toolRequestMsg.tool_calls).toBeDefined();
    expect(toolRequestMsg.tool_calls![0].function.name).toBe("hello-world");

    const toolResponseMsg = result.conversation[3] as any;
    expect(toolResponseMsg.role).toBe("tool");
    expect(typeof toolResponseMsg.content).toBe("string");

    const finalAssistantMsg = result.conversation[4] as any;
    expect(finalAssistantMsg.role).toBe("assistant");
    expect(finalAssistantMsg.content).toBe("Final answer after tool.");
  });
});
