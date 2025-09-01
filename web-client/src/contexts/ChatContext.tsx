"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useCallback,
} from "react";
import {
  ConversationMessage,
  ToolCall,
  ToolCallResult,
  Tool,
  ToolCallEvent,
  ToolCallResultEvent,
  StoredConversation,
} from "../types";

interface ChatState {
  messages: ConversationMessage[];
  isGenerating: boolean;
  currentStreamedMessage: string;
  tools: Tool[];
  showTools: boolean;
  toolCallEvents: ToolCallEvent[];
  toolResultEvents: ToolCallResultEvent[];
  currentConversationId: string | null;
  conversations: StoredConversation[];
}

type ChatAction =
  | { type: "ADD_USER_MESSAGE"; content: string }
  | { type: "ADD_ASSISTANT_MESSAGE"; content: string }
  | { type: "ADD_TOOL_CALL"; toolCall: ToolCall }
  | { type: "ADD_TOOL_RESULT"; toolResult: ToolCallResult }
  | { type: "ADD_TOOL_CALL_EVENT"; toolCallEvent: ToolCallEvent }
  | { type: "ADD_TOOL_RESULT_EVENT"; toolResultEvent: ToolCallResultEvent }
  | { type: "SET_STREAMED_MESSAGE"; content: string }
  | { type: "CLEAR_STREAMED_MESSAGE" }
  | { type: "SET_GENERATING"; isGenerating: boolean }
  | { type: "SET_TOOLS"; tools: Tool[] }
  | { type: "TOGGLE_TOOLS" }
  | { type: "CLEAR_CONVERSATION" }
  | { type: "SET_SYSTEM_MESSAGE"; content: string }
  | { type: "SET_CURRENT_CONVERSATION"; id: string | null }
  | { type: "SET_CONVERSATIONS"; conversations: StoredConversation[] }
  | { type: "ADD_CONVERSATION"; conversation: StoredConversation }
  | { type: "UPDATE_CONVERSATION"; conversation: StoredConversation }
  | { type: "REMOVE_CONVERSATION"; id: string }
  | { type: "LOAD_CONVERSATION_MESSAGES"; messages: ConversationMessage[] };

const initialState: ChatState = {
  messages: [],
  isGenerating: false,
  currentStreamedMessage: "",
  tools: [],
  showTools: false,
  toolCallEvents: [],
  toolResultEvents: [],
  currentConversationId: null,
  conversations: [],
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
          },
        ],
      };

    case "ADD_TOOL_CALL_EVENT":
      return {
        ...state,
        toolCallEvents: [...state.toolCallEvents, action.toolCallEvent],
      };

    case "ADD_TOOL_RESULT_EVENT":
      return {
        ...state,
        toolResultEvents: [...state.toolResultEvents, action.toolResultEvent],
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
        toolCallEvents: [],
        toolResultEvents: [],
      };

    case "SET_SYSTEM_MESSAGE":
      return {
        ...state,
        messages: [{ role: "system", content: action.content }],
      };

    case "SET_CURRENT_CONVERSATION":
      return {
        ...state,
        currentConversationId: action.id,
      };

    case "SET_CONVERSATIONS":
      return {
        ...state,
        conversations: action.conversations,
      };

    case "ADD_CONVERSATION":
      return {
        ...state,
        conversations: [action.conversation, ...state.conversations],
      };

    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === action.conversation.id ? action.conversation : conv
        ),
      };

    case "REMOVE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.filter(
          (conv) => conv.id !== action.id
        ),
        currentConversationId:
          state.currentConversationId === action.id
            ? null
            : state.currentConversationId,
      };

    case "LOAD_CONVERSATION_MESSAGES":
      console.log("Loading conversation messages:", action.messages);
      return {
        ...state,
        messages: action.messages,
        toolCallEvents: [],
        toolResultEvents: [],
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
  addToolCallEvent: (toolCallEvent: ToolCallEvent) => void;
  addToolResultEvent: (toolResultEvent: ToolCallResultEvent) => void;
  setStreamedMessage: (content: string) => void;
  clearStreamedMessage: () => void;
  setGenerating: (isGenerating: boolean) => void;

  setTools: (tools: Tool[]) => void;
  toggleTools: () => void;
  clearConversation: () => void;
  setSystemMessage: (content: string) => void;

  // Conversation management
  setCurrentConversation: (id: string | null) => void;
  setConversations: (conversations: StoredConversation[]) => void;
  addConversation: (conversation: StoredConversation) => void;
  updateConversation: (conversation: StoredConversation) => void;
  removeConversation: (id: string) => void;
  loadConversationMessages: (messages: ConversationMessage[]) => void;
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

  const addToolCallEvent = (toolCallEvent: ToolCallEvent) => {
    dispatch({ type: "ADD_TOOL_CALL_EVENT", toolCallEvent });
  };

  const addToolResultEvent = (toolResultEvent: ToolCallResultEvent) => {
    dispatch({ type: "ADD_TOOL_RESULT_EVENT", toolResultEvent });
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

  // Conversation management methods
  const setCurrentConversation = useCallback((id: string | null) => {
    dispatch({ type: "SET_CURRENT_CONVERSATION", id });
  }, []);

  const setConversations = useCallback(
    (conversations: StoredConversation[]) => {
      dispatch({ type: "SET_CONVERSATIONS", conversations });
    },
    []
  );

  const addConversation = useCallback((conversation: StoredConversation) => {
    dispatch({ type: "ADD_CONVERSATION", conversation });
  }, []);

  const updateConversation = useCallback((conversation: StoredConversation) => {
    dispatch({ type: "UPDATE_CONVERSATION", conversation });
  }, []);

  const removeConversation = useCallback((id: string) => {
    dispatch({ type: "REMOVE_CONVERSATION", id });
  }, []);

  const loadConversationMessages = useCallback(
    (messages: ConversationMessage[]) => {
      dispatch({ type: "LOAD_CONVERSATION_MESSAGES", messages });
    },
    []
  );

  const value: ChatContextType = {
    state,
    dispatch,
    addUserMessage,
    addAssistantMessage,
    addToolCall,
    addToolResult,
    addToolCallEvent,
    addToolResultEvent,
    setStreamedMessage,
    clearStreamedMessage,
    setGenerating,

    setTools,
    toggleTools,
    clearConversation,
    setSystemMessage,

    // Conversation management
    setCurrentConversation,
    setConversations,
    addConversation,
    updateConversation,
    removeConversation,
    loadConversationMessages,
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
