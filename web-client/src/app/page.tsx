"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatProvider } from "../contexts/ChatContext";
import { useSocket } from "../hooks/useSocket";
import { useChat } from "../contexts/ChatContext";
import { StoredConversation } from "../types";
import {
  Bot,
  Plus,
  MessageSquare,
  Clock,
  Trash2,
  Edit3,
  Brain,
} from "lucide-react";

function HomePageContent() {
  const router = useRouter();
  const {
    isConnected,
    listConversations,
    createConversation,
    deleteConversation,
    renameConversation,
  } = useSocket();
  const { state, setConversations } = useChat();
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const loadConversations = async () => {
      if (isConnected) {
        try {
          setIsLoading(true);
          const conversations = await listConversations();
          setConversations(conversations);

          // No automatic redirect - users stay on homepage and choose manually
        } catch (error) {
          console.error("Failed to load conversations:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadConversations();
  }, [isConnected, listConversations, setConversations, router]);

  const handleCreateConversation = async () => {
    try {
      setIsLoading(true);
      const newConversation = await createConversation();
      setConversations([newConversation, ...state.conversations]);
      router.push(`/chat/${newConversation.id}`);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = (conversation: StoredConversation) => {
    router.push(`/chat/${conversation.id}`);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations(state.conversations.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const handleRenameConversation = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editName.trim()) {
      try {
        await renameConversation(id, editName.trim());
        setConversations(
          state.conversations.map((c) =>
            c.id === id ? { ...c, name: editName.trim() } : c
          )
        );
        setEditingId(null);
        setEditName("");
      } catch (error) {
        console.error("Failed to rename conversation:", error);
      }
    }
  };

  const startEditing = (
    conversation: StoredConversation,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditName(conversation.name);
  };

  const formatDate = (dateInput: Date | string) => {
    try {
      const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }

      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (diffInHours < 48) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString("en-US");
      }
    } catch (error) {
      console.error("Error formatting date:", error, dateInput);
      return "Invalid date";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Bot className="w-12 h-12 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold">Tiny Agent Chat</h1>
                <p className="text-gray-400">
                  Your AI-powered conversation assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/memories")}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
              >
                <Brain className="w-4 h-4" />
                Memories
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="w-5 h-5" />
                New Conversation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="max-w-4xl mx-auto p-6">
        {state.conversations.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold mb-2">No conversations yet</h2>
            <p className="text-gray-400 mb-6">
              Start your first conversation to get started!
            </p>
            <button
              onClick={handleCreateConversation}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Create First Conversation
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-4">Recent Conversations</h2>
            {state.conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-4 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {editingId === conversation.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenameConversation(conversation.id);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                              setEditName("");
                            }
                          }}
                          className="bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={(e) =>
                            handleRenameConversation(conversation.id, e)
                          }
                          className="text-green-400 hover:text-green-300 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditName("");
                          }}
                          className="text-gray-400 hover:text-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <h3 className="font-medium text-white truncate">
                        {conversation.name || "Untitled Conversation"}
                      </h3>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(conversation.created_at)}
                      </div>
                      {conversation.messages &&
                        Array.isArray(conversation.messages) && (
                          <span>{conversation.messages.length} messages</span>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEditing(conversation, e)}
                      className="text-gray-400 hover:text-blue-400 p-1"
                      title="Rename"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) =>
                        handleDeleteConversation(conversation.id, e)
                      }
                      className="text-gray-400 hover:text-red-400 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ChatProvider>
      <HomePageContent />
    </ChatProvider>
  );
}
