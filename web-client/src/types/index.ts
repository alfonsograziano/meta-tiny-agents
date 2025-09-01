import { OpenAI } from "openai";

// Type guard to check if a message has tool_calls
export function hasToolCalls(
  message: ConversationMessage
): message is OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
  return (
    "tool_calls" in message &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  );
}

// New conversation types for the backend storage
export type ConversationMessage =
  | OpenAI.Chat.Completions.ChatCompletionMessageParam
  | OpenAI.Chat.Completions.ChatCompletionMessage
  | OpenAI.Chat.Completions.ChatCompletionToolMessageParam
  | OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;

export interface StoredConversation {
  id: string;
  name: string;
  messages: ConversationMessage[];
  created_at: Date;
  updated_at: Date;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  durationMs: number;
}

// Types for tool call events from the backend
export interface ToolCallEvent {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallResultEvent {
  toolCallId: string;
  toolName: string;
  params: unknown;
  result: unknown;
  startTime: number;
  endTime: number;
  durationMs: number;
}

export interface SocketEventResult<T> {
  status: string;
  result: T;
}

export interface Tool {
  clientName: string;
  function: {
    name: string;
    description: string;
  };
}

export interface GenerateAnswerRequest {
  messages: ConversationMessage[];
  ragQueries: string[];
  conversationId?: string;
}

export interface GenerateAnswerResponse {
  content: string;
  streamed: boolean;
}
