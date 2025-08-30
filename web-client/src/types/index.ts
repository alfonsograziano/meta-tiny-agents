export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  type?: string;
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
}

export interface GenerateAnswerResponse {
  content: string;
  streamed: boolean;
}
