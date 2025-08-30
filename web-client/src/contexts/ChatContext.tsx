"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { ConversationMessage, ToolCall, ToolCallResult, Tool } from "../types";

interface ChatState {
  messages: ConversationMessage[];
  isGenerating: boolean;
  currentStreamedMessage: string;
  tools: Tool[];
  showTools: boolean;
}

type ChatAction =
  | { type: "ADD_USER_MESSAGE"; content: string }
  | { type: "ADD_ASSISTANT_MESSAGE"; content: string }
  | { type: "ADD_TOOL_CALL"; toolCall: ToolCall }
  | { type: "ADD_TOOL_RESULT"; toolResult: ToolCallResult }
  | { type: "SET_STREAMED_MESSAGE"; content: string }
  | { type: "CLEAR_STREAMED_MESSAGE" }
  | { type: "SET_GENERATING"; isGenerating: boolean }
  | { type: "SET_TOOLS"; tools: Tool[] }
  | { type: "TOGGLE_TOOLS" }
  | { type: "CLEAR_CONVERSATION" }
  | { type: "SET_SYSTEM_MESSAGE"; content: string };

const initialState: ChatState = {
  messages: [],
  isGenerating: false,
  currentStreamedMessage: "",
  tools: [],
  showTools: false,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_USER_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: "user", content: action.content },
        ],
      };

    case "ADD_ASSISTANT_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: "assistant", content: action.content },
        ],
        currentStreamedMessage: "",
      };

    case "ADD_TOOL_CALL":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: action.toolCall.id,
                type: "function",
                function: {
                  name: action.toolCall.function.name,
                  arguments: action.toolCall.function.arguments || "{}",
                },
              },
            ],
          },
        ],
      };

    case "ADD_TOOL_RESULT":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "tool",
            content: JSON.stringify(action.toolResult.result),
            tool_call_id: action.toolResult.toolCallId,
            type: "function_call_output",
          },
        ],
      };

    case "SET_STREAMED_MESSAGE":
      return {
        ...state,
        currentStreamedMessage: action.content,
      };

    case "CLEAR_STREAMED_MESSAGE":
      return {
        ...state,
        currentStreamedMessage: "",
      };

    case "SET_GENERATING":
      return {
        ...state,
        isGenerating: action.isGenerating,
      };

    case "SET_TOOLS":
      return {
        ...state,
        tools: action.tools,
      };

    case "TOGGLE_TOOLS":
      return {
        ...state,
        showTools: !state.showTools,
      };

    case "CLEAR_CONVERSATION":
      return {
        ...state,
        messages: [],
        currentStreamedMessage: "",
      };

    case "SET_SYSTEM_MESSAGE":
      return {
        ...state,
        messages: [{ role: "system", content: action.content }],
      };

    default:
      return state;
  }
}

interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  addToolCall: (toolCall: ToolCall) => void;
  addToolResult: (toolResult: ToolCallResult) => void;
  setStreamedMessage: (content: string) => void;
  clearStreamedMessage: () => void;
  setGenerating: (isGenerating: boolean) => void;

  setTools: (tools: Tool[]) => void;
  toggleTools: () => void;
  clearConversation: () => void;
  setSystemMessage: (content: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const addUserMessage = (content: string) => {
    dispatch({ type: "ADD_USER_MESSAGE", content });
  };

  const addAssistantMessage = (content: string) => {
    dispatch({ type: "ADD_ASSISTANT_MESSAGE", content });
  };

  const addToolCall = (toolCall: ToolCall) => {
    dispatch({ type: "ADD_TOOL_CALL", toolCall });
  };

  const addToolResult = (toolResult: ToolCallResult) => {
    dispatch({ type: "ADD_TOOL_RESULT", toolResult });
  };

  const setStreamedMessage = (content: string) => {
    dispatch({ type: "SET_STREAMED_MESSAGE", content });
  };

  const clearStreamedMessage = () => {
    dispatch({ type: "CLEAR_STREAMED_MESSAGE" });
  };

  const setGenerating = (isGenerating: boolean) => {
    dispatch({ type: "SET_GENERATING", isGenerating });
  };

  const setTools = (tools: Tool[]) => {
    dispatch({ type: "SET_TOOLS", tools });
  };

  const toggleTools = () => {
    dispatch({ type: "TOGGLE_TOOLS" });
  };

  const clearConversation = () => {
    dispatch({ type: "CLEAR_CONVERSATION" });
  };

  const setSystemMessage = (content: string) => {
    dispatch({ type: "SET_SYSTEM_MESSAGE", content });
  };

  const value: ChatContextType = {
    state,
    dispatch,
    addUserMessage,
    addAssistantMessage,
    addToolCall,
    addToolResult,
    setStreamedMessage,
    clearStreamedMessage,
    setGenerating,

    setTools,
    toggleTools,
    clearConversation,
    setSystemMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
