"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Message } from "./Message";
import { ChatInput } from "./ChatInput";
import { ConversationsSidebar } from "./ConversationsSidebar";
import { useSocket } from "../hooks/useSocket";
import { useChat } from "../contexts/ChatContext";
import {
  ToolCall,
  ToolCallResult,
  StoredConversation,
  ConversationMessage,
} from "../types";
import {
  Bot,
  AlertCircle,
  CheckCircle,
  Loader2,
  Wrench,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { ToolAccordion } from "./ToolAccordion";

export function Chat() {
  const router = useRouter();
  const {
    socket,
    isConnected,
    isConnecting,
    error,
    listTools,
    generateRagQueries,
    generateAnswer,
    generateRecipe,
    createConversation,
    listConversations,
    deleteConversation,
    renameConversation,
  } = useSocket();
  const {
    state,
    addUserMessage,
    addAssistantMessage,
    addToolCall,
    addToolResult,
    setStreamedMessage,
    clearStreamedMessage,
    setGenerating,
    setTools,
    clearConversation,
    setCurrentConversation,
    setConversations,
    addConversation,
    updateConversation,
    removeConversation,
    loadConversationMessages,
  } = useChat();

  const [conversationsSidebarOpen, setConversationsSidebarOpen] =
    useState(false);
  const [showFullConversation, setShowFullConversation] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [ragEnabled, setRagEnabled] = useState(false);
  const [isGeneratingRAG, setIsGeneratingRAG] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [
    state.messages,
    state.currentStreamedMessage,
    state.toolCallEvents,
    state.toolResultEvents,
  ]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleStreamAnswer = (chunk: string) => {
      // Accumulate streaming chunks
      setStreamingContent((prev) => prev + chunk);
    };

    const handleToolCall = (toolCall: ToolCall) => {
      addToolCall(toolCall);
    };

    const handleToolCallResult = (toolCallResult: ToolCallResult) => {
      addToolResult(toolCallResult);
    };

    socket.on("stream-answer", handleStreamAnswer);
    socket.on("tool-call", handleToolCall);
    socket.on("tool-call-result", handleToolCallResult);

    return () => {
      socket.off("stream-answer", handleStreamAnswer);
      socket.off("tool-call", handleToolCall);
      socket.off("tool-call-result", handleToolCallResult);
    };
  }, [
    socket,
    addToolCall,
    addToolResult,
    setStreamedMessage,
    addAssistantMessage,
    setGenerating,
  ]);

  // Load tools on connection
  const loadTools = useCallback(async () => {
    try {
      const tools = await listTools();
      setTools(tools);
    } catch (err) {
      console.error("Failed to load tools:", err);
    }
  }, [listTools, setTools]);

  useEffect(() => {
    if (isConnected) {
      loadTools();
    }
  }, [isConnected, loadTools]);

  // Safety mechanism: reset generating state if it gets stuck
  useEffect(() => {
    if (state.isGenerating) {
      const safetyTimeout = setTimeout(() => {
        console.warn("Generating state stuck, resetting...");
        setGenerating(false);
      }, 10000); // 10 seconds max

      return () => clearTimeout(safetyTimeout);
    }
  }, [state.isGenerating, setGenerating]);

  // Handle streaming completion - add streaming content to conversation when generating stops
  useEffect(() => {
    if (!state.isGenerating && streamingContent) {
      // Add the streaming content to the conversation when generating stops
      addAssistantMessage(streamingContent);
      setStreamingContent("");
    }
  }, [state.isGenerating, addAssistantMessage]);

  // Sync streaming content with streamed message
  useEffect(() => {
    if (streamingContent) {
      setStreamedMessage(streamingContent);
    }
  }, [streamingContent, setStreamedMessage]);

  const handleSendMessage = async (message: string) => {
    if (!isConnected) return;

    addUserMessage(message);
    setGenerating(true);
    clearStreamedMessage();
    setStreamingContent("");

    try {
      // Generate RAG queries if enabled
      let ragQueries: string[] = [];
      if (ragEnabled) {
        setIsGeneratingRAG(true);
        try {
          ragQueries = await generateRagQueries([
            ...state.messages,
            { role: "user", content: message },
          ]);
          console.log("Generated RAG queries:", ragQueries);
        } catch (err) {
          console.error("RAG query generation failed:", err);
        } finally {
          setIsGeneratingRAG(false);
        }
      }

      // Generate answer - this should trigger streaming
      await generateAnswer({
        messages: [...state.messages, { role: "user", content: message }],
        ragQueries,
        conversationId: state.currentConversationId || undefined,
      });

      // The response will be handled by socket streaming events
      // Set generating to false when the server callback is received (streaming complete)
      setGenerating(false);
    } catch (err) {
      console.error("Failed to generate answer:", err);
      addAssistantMessage(
        "Sorry, I encountered an error while generating your answer. Please try again."
      );
      setGenerating(false);
    }
  };

  const handleCommand = async (command: string) => {
    if (!isConnected) return;

    switch (command) {
      case "help":
        addAssistantMessage(`Available commands:
• /help - Show this help message
• /list_tools - List available tools
• /generate_recipe - Generate a recipe for the current conversation
• /get_full_conversation - Show the full conversation
• /start_browser - Start the browser automation`);
        break;

      case "list_tools":
        try {
          const tools = await listTools();
          const toolsList = tools
            .map(
              (tool) =>
                `[${tool.clientName}]: ${tool.function.name} - ${tool.function.description}`
            )
            .join("\n\n");

          const clients = [...new Set(tools.map((tool) => tool.clientName))];
          const summary = `You have access to ${tools.length} tools from ${
            clients.length
          } different clients:\n\n${clients.join(", ")}`;

          addAssistantMessage(`${toolsList}\n\n${summary}`);
        } catch {
          addAssistantMessage("Failed to list tools. Please try again.");
        }
        break;

      case "generate_recipe":
        try {
          setGenerating(true);
          const recipe = await generateRecipe(state.messages);
          addAssistantMessage(`Recipe generated:\n\n${recipe}`);
        } catch {
          addAssistantMessage("Failed to generate recipe. Please try again.");
        } finally {
          setGenerating(false);
        }
        break;

      case "get_full_conversation":
        setShowFullConversation(!showFullConversation);
        break;

      case "start_browser":
        addAssistantMessage(
          "Browser automation started. This feature is available in the CLI version."
        );
        break;

      default:
        addAssistantMessage(
          `Unknown command: ${command}. Type /help for available commands.`
        );
    }
  };

  const handleClearConversation = () => {
    clearConversation();
    setShowFullConversation(false);
  };

  // Conversation management functions
  const handleCreateConversation = async () => {
    try {
      const newConversation = await createConversation();
      addConversation(newConversation);
      setCurrentConversation(newConversation.id);
      clearConversation();
      setConversationsSidebarOpen(false);
      // Redirect to the new conversation
      router.push(`/chat/${newConversation.id}`);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const handleSelectConversation = async (conversation: StoredConversation) => {
    try {
      console.log("Selecting conversation:", conversation);
      console.log("Messages type:", typeof conversation.messages);
      console.log("Messages value:", conversation.messages);

      // Set as current conversation in frontend
      setCurrentConversation(conversation.id);

      // Load conversation messages with safety check
      let messages: ConversationMessage[] = [];
      if (Array.isArray(conversation.messages)) {
        messages = conversation.messages;
      }

      console.log("Processed messages:", messages);
      loadConversationMessages(messages);
      setConversationsSidebarOpen(false);
      // Redirect to the selected conversation
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      console.error("Failed to select conversation:", error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      removeConversation(id);

      // If this was the current conversation, clear it
      if (state.currentConversationId === id) {
        setCurrentConversation(null);
        clearConversation();
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const handleRenameConversation = async (id: string, name: string) => {
    try {
      await renameConversation(id, name);

      // Update the conversation in the list
      const updatedConversation = state.conversations.find((c) => c.id === id);
      if (updatedConversation) {
        updateConversation({
          ...updatedConversation,
          name,
        });
      }
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  // Function to refresh conversations manually
  const refreshConversations = useCallback(async () => {
    if (isConnected) {
      try {
        setIsLoadingConversations(true);
        const conversations = await listConversations();
        setConversations(conversations);
        // Don't reset conversationsLoaded here as this is a manual refresh
      } catch (error) {
        console.error("Failed to refresh conversations:", error);
      } finally {
        setIsLoadingConversations(false);
      }
    }
  }, [isConnected, listConversations]);

  // Command handler for tools and help
  const onCommand = (command: string) => {
    handleCommand(command);
  };

  // Load conversations on mount and when connection status changes
  useEffect(() => {
    if (isConnected && !conversationsLoaded) {
      const loadConversations = async () => {
        try {
          setIsLoadingConversations(true);
          const conversations = await listConversations();
          setConversations(conversations);
          setConversationsLoaded(true);
        } catch (error) {
          console.error("Failed to load conversations:", error);
        } finally {
          setIsLoadingConversations(false);
        }
      };

      loadConversations();
    } else if (!isConnected) {
      // Reset when disconnected
      setConversationsLoaded(false);
      setConversations([]);
    }
  }, [isConnected, listConversations, conversationsLoaded]); // Added conversationsLoaded to prevent multiple loads

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Reset conversations when component unmounts
      setConversations([]);
      setConversationsLoaded(false);
    };
  }, []);

  // Debug effect to monitor messages state
  useEffect(() => {
    console.log("Messages state changed:", {
      messagesCount: state.messages.length,
      messages: state.messages,
      currentConversationId: state.currentConversationId,
    });
  }, [state.messages, state.currentConversationId]);

  // Connection status component
  const ConnectionStatus = () => {
    if (isConnecting) {
      return (
        <div className="flex items-center gap-2 text-yellow-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Connecting...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span>Connection failed</span>
        </div>
      );
    }

    if (isConnected) {
      return (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span>Connected</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-gray-400">
        <AlertCircle className="w-4 h-4" />
        <span>Disconnected</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Top Navbar - Fixed */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-400" />
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold text-white">Tiny Agents Chat</h1>
              <ConnectionStatus />
              {state.currentConversationId && (
                <div className="text-xs text-blue-300">
                  {
                    state.conversations.find(
                      (c) => c.id === state.currentConversationId
                    )?.name
                  }
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400">
            {isGeneratingRAG && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching for relevant information...</span>
              </div>
            )}

            {/* Back to conversations button */}
            <button
              onClick={() => router.push("/")}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1 rounded-lg transition-colors flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Conversations
            </button>

            {/* Tools button */}
            <button
              onClick={() => onCommand("list_tools")}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1 rounded-lg transition-colors flex items-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              Tools
            </button>

            {/* Help button */}
            <button
              onClick={() => onCommand("help")}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1 rounded-lg transition-colors flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Help
            </button>

            {/* Clear conversation button */}
            <button
              onClick={handleClearConversation}
              className="bg-red-700 hover:bg-red-600 text-red-200 hover:text-white px-3 py-1 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Flex container */}
      <div className="flex flex-1 min-h-0">
        <ConversationsSidebar
          isOpen={conversationsSidebarOpen}
          onToggle={() =>
            setConversationsSidebarOpen(!conversationsSidebarOpen)
          }
          conversations={state.conversations}
          currentConversationId={state.currentConversationId}
          onCreateConversation={handleCreateConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onRefreshConversations={refreshConversations}
          isLoading={isLoadingConversations}
        />

        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-4xl flex flex-col min-h-0">
            {/* Messages Container - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {state.messages.length === 0 &&
              state.toolCallEvents.length === 0 &&
              state.toolResultEvents.length === 0 ? (
                <div className="text-center text-gray-400 mt-20">
                  <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h2 className="text-xl font-semibold mb-2">
                    Welcome to Tiny Agents
                  </h2>
                  {state.currentConversationId ? (
                    <div className="space-y-2">
                      <p className="text-blue-400 mb-2">
                        Current conversation:{" "}
                        {
                          state.conversations.find(
                            (c) => c.id === state.currentConversationId
                          )?.name
                        }
                      </p>
                      <div className="text-sm text-gray-500">
                        Messages: {state.messages.length}
                      </div>
                      <button
                        onClick={() => {
                          const currentConv = state.conversations.find(
                            (c) => c.id === state.currentConversationId
                          );
                          if (currentConv) {
                            console.log("Current conversation:", currentConv);
                            console.log(
                              "Current messages state:",
                              state.messages
                            );
                          }
                        }}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs"
                      >
                        Debug Info
                      </button>
                    </div>
                  ) : state.conversations.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-gray-500 mb-2">
                        No conversations yet. Create your first conversation to
                        get started!
                      </p>
                      <button
                        onClick={handleCreateConversation}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Create First Conversation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-gray-500 mb-2">
                        No active conversation. Create a new one or select an
                        existing one from the sidebar.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateConversation}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          New Conversation
                        </button>
                        <button
                          onClick={() => router.push("/")}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          View All Conversations
                        </button>
                      </div>
                    </div>
                  )}
                  <p>Start a conversation by typing a message below.</p>
                </div>
              ) : (
                <>
                  {/* Tool Call Events - Show when tools are being called */}
                  {state.toolCallEvents.map((toolCallEvent, index) => (
                    <ToolAccordion
                      key={`tool-call-${index}`}
                      toolName={toolCallEvent.function.name}
                      toolCallId={toolCallEvent.id}
                      arguments={toolCallEvent.function.arguments}
                      type="call"
                    />
                  ))}

                  {/* Tool Result Events - Show when tools complete */}
                  {state.toolResultEvents.map((toolResultEvent, index) => (
                    <ToolAccordion
                      key={`tool-result-${index}`}
                      toolName={toolResultEvent.toolName}
                      toolCallId={toolResultEvent.toolCallId}
                      arguments=""
                      type="result"
                      durationMs={toolResultEvent.durationMs}
                      result={toolResultEvent.result}
                      params={toolResultEvent.params}
                      startTime={toolResultEvent.startTime}
                      endTime={toolResultEvent.endTime}
                    />
                  ))}

                  {/* Regular Messages */}
                  {state.messages.map((message, index) => (
                    <Message key={index} message={message} />
                  ))}

                  {/* Generating indicator - show while generating but before streaming starts */}
                  {state.isGenerating && !streamingContent && (
                    <Message
                      message={{
                        role: "assistant",
                        content: "",
                      }}
                      isGenerating={true}
                      isGeneratingRAG={isGeneratingRAG}
                    />
                  )}

                  {/* Streaming message - only show when actively streaming and not yet added to conversation */}
                  {streamingContent && state.isGenerating && (
                    <Message
                      message={{
                        role: "assistant",
                        content: streamingContent,
                      }}
                      isStreaming={true}
                    />
                  )}
                </>
              )}

              {/* Full conversation modal */}
              {showFullConversation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                  <div className="bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        Full Conversation
                      </h3>
                      <button
                        onClick={() => setShowFullConversation(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                      {JSON.stringify(state.messages, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input - Fixed at bottom */}
            <div className="flex-shrink-0">
              <ChatInput
                onSendMessage={handleSendMessage}
                onCommand={handleCommand}
                disabled={!isConnected || state.isGenerating}
                placeholder={
                  state.isGenerating
                    ? "Generating answer..."
                    : "Ask anything..."
                }
                ragEnabled={ragEnabled}
                onToggleRAG={() => setRagEnabled(!ragEnabled)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
