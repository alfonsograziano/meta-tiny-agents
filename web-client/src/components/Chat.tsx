"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "./Message";
import { ChatInput } from "./ChatInput";
import { Sidebar } from "./Sidebar";
import { useSocket } from "../hooks/useSocket";
import { useChat } from "../contexts/ChatContext";
import { ToolCall, ToolCallResult } from "../types";
import { Bot, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export function Chat() {
  const {
    socket,
    isConnected,
    isConnecting,
    error,
    listTools,
    generateRagQueries,
    generateAnswer,
    generateRecipe,
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
    setGeneratingRAG,
    setTools,
    clearConversation,
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFullConversation, setShowFullConversation] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, state.currentStreamedMessage]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleStreamAnswer = (chunk: string) => {
      // Accumulate streaming chunks
      setStreamingContent((prev) => prev + chunk);
      setStreamedMessage(streamingContent + chunk);
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
    streamingContent,
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

  const handleSendMessage = async (message: string) => {
    if (!isConnected) return;

    addUserMessage(message);
    setGenerating(true);
    clearStreamedMessage();
    setStreamingContent("");

    try {
      // Generate RAG queries if enabled
      let ragQueries: string[] = [];
      setGeneratingRAG(true);
      try {
        ragQueries = await generateRagQueries([
          ...state.messages,
          { role: "user", content: message },
        ]);
        setGeneratingRAG(false);
      } catch {
        console.error("RAG query generation failed");
        setGeneratingRAG(false);
      }

      // Generate answer
      const answer = await generateAnswer({
        messages: [...state.messages, { role: "user", content: message }],
        ragQueries,
      });

      // Add the final answer content
      if (answer.content) {
        addAssistantMessage(answer.content);
      } else if (streamingContent) {
        // If no direct content but we have streaming, use that
        addAssistantMessage(streamingContent);
      }

      // Clear streaming content after adding the message
      setStreamingContent("");
    } catch (err) {
      console.error("Failed to generate answer:", err);
      addAssistantMessage(
        "Sorry, I encountered an error while generating your answer. Please try again."
      );
    } finally {
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
    <div className="flex h-screen bg-gray-900">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        tools={state.tools}
        onCommand={handleCommand}
        onClearConversation={handleClearConversation}
        messageCount={state.messages.length}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-xl font-bold text-white">
                  Tiny Agents Chat
                </h1>
                <ConnectionStatus />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-400">
              {state.isGeneratingRAG && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating RAG queries...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {state.messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h2 className="text-xl font-semibold mb-2">
                Welcome to Tiny Agents
              </h2>
              <p>Start a conversation by typing a message below.</p>
            </div>
          ) : (
            <>
              {state.messages.map((message, index) => (
                <Message key={index} message={message} />
              ))}

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

        {/* Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          onCommand={handleCommand}
          disabled={!isConnected || state.isGenerating}
          placeholder={
            state.isGenerating ? "Generating answer..." : "Ask anything..."
          }
        />
      </div>
    </div>
  );
}
