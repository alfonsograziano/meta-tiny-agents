import { ClientsRegistry } from "./clientsRegistry.js";
import { OpenAI } from "openai";
import {
  getSystemPromptDesigner,
  getSystemPromptFromAgentResponse,
  PROMPT_DESIGNER_SYSTEM_PROMPT,
} from "./prompts.ts";

/**
 * Represents a conversation message originating from a tool function call.
 */
export interface ToolFunctionOutputMessage {
  type: "function_call_output";
  tool_call_id: string;
  content: string;
  role: "tool";
}

/**
 * Union type for any message exchanged during the TinyAgent run:
 * - OpenAI.Chat.Completions.ChatCompletionMessageParam: messages sent to the LLM (system/user/function_call_output)
 * - OpenAI.Chat.Completions.ChatCompletionMessage: messages received from the LLM (assistant or function_call)
 * - ToolFunctionOutputMessage: messages returned by a tool
 */
export type ConversationMessage =
  | OpenAI.Chat.Completions.ChatCompletionMessageParam
  | OpenAI.Chat.Completions.ChatCompletionMessage
  | ToolFunctionOutputMessage;

/**
 * Telemetry for a single LLM invocation.
 */
export interface LLMTelemetry {
  requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  responseMessage: OpenAI.Chat.Completions.ChatCompletionMessage;
  startTime: number;
  endTime: number;
  durationMs: number;
}

/**
 * Telemetry for a single tool invocation.
 */
export interface ToolCallTelemetry {
  toolCallId: string;
  toolName: string;
  params: unknown;
  result: unknown;
  startTime: number;
  endTime: number;
  durationMs: number;
}

/**
 * Result object returned by TinyAgent.run(...)
 */
export interface TinyAgentRunResult {
  conversation: ConversationMessage[];
  llmCalls: LLMTelemetry[];
  toolCalls: ToolCallTelemetry[];
}

/**
 * Configuration options for constructing a TinyAgent.
 */
export interface TinyAgentConfig {
  maxInteractions?: number;
}

/**
 * TinyAgent orchestrates a loop of chatting with an LLM, invoking tools automatically,
 * and collecting detailed telemetry about each LLM and tool call.
 */
export class TinyAgent {
  private readonly maxInteractions: number;
  private readonly registry: ClientsRegistry;

  /**
   * @param config.maxInteractions Maximum number of LLM ↔ tool iterations (default 10).
   */
  constructor(config: TinyAgentConfig = {}) {
    this.maxInteractions = config.maxInteractions ?? 10;
    this.registry = new ClientsRegistry();
  }

  /**
   * Runs the TinyAgent loop.
   *
   * @param options.openai      An instantiated OpenAI client.
   * @param options.baseMessages An array of initial messages to prime the LLM.
   *
   * The TinyAgent will:
   *  1. Retrieve available tools from its ClientsRegistry.
   *  2. Enter a loop up to maxInteractions times (or until the model stops requesting tools).
   *  3. For each iteration:
   *     - Send all accumulated messages to openai.chat.completions.create(), measuring telemetry.
   *     - If the model requests one or more tool calls (via message.tool_calls), invoke each
   *       using ClientsRegistry.callTool(), measuring telemetry, and append the outputs as
   *       ToolFunctionOutputMessage messages.
   *     - Accumulate all messages in the conversation.
   *
   * @returns A Promise resolving to a TinyAgentRunResult containing:
   *   - conversation: the full sequence of messages (ChatCompletionMessageParam |
   *     ChatCompletionMessage | ToolFunctionOutputMessage).
   *   - llmCalls: array of telemetry data for each LLM invocation.
   *   - toolCalls: array of telemetry data for each tool invocation.
   */
  public async run(options: {
    openai: OpenAI;
    baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    requestInputFromUser?: (question: string) => Promise<string>;
  }): Promise<TinyAgentRunResult> {
    const mcpTools = await this.registry.getTools();
    // Map MCP tools into OpenAI's ChatCompletionTool format
    const availableTools: OpenAI.Chat.ChatCompletionTool[] = mcpTools.map(
      (tool) => ({
        type: "function",
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      })
    );

    const conversation: ConversationMessage[] = [...options.baseMessages];
    const llmCalls: LLMTelemetry[] = [];
    const toolCalls: ToolCallTelemetry[] = [];

    let interactionCount = 0;
    let taskCompleteAck = 0;

    while (interactionCount < this.maxInteractions && taskCompleteAck < 2) {
      interactionCount++;

      const llmStart = Date.now();
      //TODO: Pass model as an option
      const response = await options.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: conversation,
        tools: availableTools,
        tool_choice: "auto",
      });
      const llmEnd = Date.now();

      const responseMessage = response.choices[0]
        .message as OpenAI.Chat.Completions.ChatCompletionMessage;

      llmCalls.push({
        requestMessages: conversation,
        responseMessage,
        startTime: llmStart,
        endTime: llmEnd,
        durationMs: llmEnd - llmStart,
      });

      conversation.push(responseMessage);

      const toolCallsRequested = responseMessage.tool_calls as
        | Array<{
            id: string;
            function: { name: string; arguments: string };
          }>
        | undefined;

      if (!toolCallsRequested || toolCallsRequested.length === 0) {
        break;
      }

      // TODO: Make executions in parallel instead of sequentially
      // TODO: Create a tool, capable of spawning a new TinyAgent instance
      for (const toolCall of toolCallsRequested) {
        const toolCallId = toolCall.id;
        const functionName = toolCall.function.name;
        const params = JSON.parse(toolCall.function.arguments || "{}");

        const toolStart = Date.now();
        let result = "";
        if (functionName === "task_complete") {
          taskCompleteAck++;
        } else if (functionName === "ask_question") {
          if (typeof options.requestInputFromUser !== "function") {
            throw new Error(
              "Function 'ask_question' requires a requestInputFromUser callback to be provided."
            );
          }
          const userResponse = await options.requestInputFromUser(
            params.questions
          );
          result = userResponse;
        } else {
          result = await this.registry.callTool(toolCall);
        }

        const toolEnd = Date.now();

        toolCalls.push({
          toolCallId,
          toolName: functionName,
          params,
          result,
          startTime: toolStart,
          endTime: toolEnd,
          durationMs: toolEnd - toolStart,
        });

        const functionOutputMessage: ToolFunctionOutputMessage = {
          type: "function_call_output",
          tool_call_id: toolCallId,
          content: JSON.stringify(result),
          role: "tool",
        };
        conversation.push(functionOutputMessage);
      }
    }

    return {
      conversation,
      llmCalls,
      toolCalls,
    };
  }

  public async generateSystemPrompt(options: {
    openai: OpenAI;
    goal: string;
  }): Promise<string> {
    const result = await this.run({
      openai: options.openai,
      baseMessages: [
        {
          role: "system",
          content: PROMPT_DESIGNER_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: getSystemPromptDesigner(options.goal),
        },
      ],
    });
    const lastMessage = result.conversation[result.conversation.length - 1];
    if (lastMessage.role !== "assistant") {
      throw new Error("Expected the last message to be from the assistant.");
    }
    const systemPrompt = lastMessage.content;
    if (!systemPrompt) {
      throw new Error("The system prompt is empty.");
    }
    return getSystemPromptFromAgentResponse(systemPrompt as string);
  }

  /**
   * Exposes the underlying ClientsRegistry so that external code can register new servers directly.
   */
  public getClientsRegistry(): ClientsRegistry {
    return this.registry;
  }
}
