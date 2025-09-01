"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatProvider } from "../../../contexts/ChatContext";
import { Chat } from "../../../components/Chat";
import { useSocket } from "../../../hooks/useSocket";
import { useChat } from "../../../contexts/ChatContext";

function ChatPageContent() {
  const params = useParams();
  const router = useRouter();
  const { getConversation, isConnected, isConnecting } = useSocket();
  const { state, setCurrentConversation, loadConversationMessages } = useChat();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chatId = params.chatId as string;

  useEffect(() => {
    const loadConversation = async () => {
      if (!chatId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Wait for socket connection to be established
        if (!isConnected) {
          console.log("Waiting for socket connection...");
          return; // Don't proceed until connected
        }

        // Fetch the conversation data
        const conversation = await getConversation(chatId);

        // Set as current conversation
        setCurrentConversation(conversation.id);

        // Load the conversation messages
        if (conversation.messages && Array.isArray(conversation.messages)) {
          const messages = conversation.messages;
          loadConversationMessages(messages);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load conversation:", error);
        setError(
          "Failed to load conversation. It may not exist or you may not have access to it."
        );
        setIsLoading(false);
        // Don't redirect automatically - let user decide
      }
    };

    loadConversation();
  }, [
    chatId,
    getConversation,
    setCurrentConversation,
    loadConversationMessages,
    isConnected, // Add isConnected to dependencies
  ]);

  // Show loading state while conversation is being loaded
  if (isLoading || isConnecting || !isConnected) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">
          <div className="mb-4">
            {isConnecting
              ? "Connecting to server..."
              : "Loading conversation..."}
          </div>
          <div className="text-sm text-gray-400">
            {isConnecting
              ? "Establishing connection to the chat server."
              : !isConnected
              ? "Waiting for server connection..."
              : "Please wait while we fetch the conversation data."}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if conversation failed to load
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center text-white">
          <div className="mb-4 text-red-400">{error}</div>
          <div className="space-y-2">
            <button
              onClick={() => router.push("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Conversations
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors ml-2"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while conversation is being set up
  if (!state.currentConversationId || state.currentConversationId !== chatId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">
          <div className="mb-4">Setting up conversation...</div>
          <div className="text-sm text-gray-400">
            Please wait while we prepare the chat interface.
          </div>
        </div>
      </div>
    );
  }

  return <Chat />;
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatPageContent />
    </ChatProvider>
  );
}
