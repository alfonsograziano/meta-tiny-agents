"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Memory } from "../../types";
import { Bot, Plus, Edit3, Trash2, Save, X, ArrowLeft } from "lucide-react";

const API_BASE_URL = "http://localhost:3002/api";

export default function MemoriesPage() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/memories`);
      const data = await response.json();

      if (data.status === "ok") {
        setMemories(data.result);
      } else {
        console.error("Failed to load memories:", data.error);
      }
    } catch (error) {
      console.error("Failed to load memories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMemory = async () => {
    if (!newMemoryContent.trim()) return;

    try {
      setIsCreating(true);
      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newMemoryContent.trim() }),
      });

      const data = await response.json();

      if (data.status === "ok") {
        setMemories([data.result, ...memories]);
        setNewMemoryContent("");
      } else {
        console.error("Failed to create memory:", data.error);
      }
    } catch (error) {
      console.error("Failed to create memory:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateMemory = async (id: number) => {
    if (!editContent.trim() || isUpdating) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`${API_BASE_URL}/memories/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      const data = await response.json();

      if (data.status === "ok") {
        setMemories(
          memories.map((memory) => (memory.id === id ? data.result : memory))
        );
        setEditingId(null);
        setEditContent("");
      } else {
        console.error("Failed to update memory:", data.error);
      }
    } catch (error) {
      console.error("Failed to update memory:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/memories/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.status === "ok") {
        setMemories(memories.filter((memory) => memory.id !== id));
      } else {
        console.error("Failed to delete memory:", data.error);
      }
    } catch (error) {
      console.error("Failed to delete memory:", error);
    }
  };

  const startEditing = (memory: Memory) => {
    setEditingId(memory.id);
    setEditContent(memory.text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
  };

  const formatDate = (dateInput: Date | string) => {
    try {
      const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

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
        <div className="text-white">Loading memories...</div>
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
                <h1 className="text-3xl font-bold">Memories</h1>
                <p className="text-gray-400">
                  Store and manage your personal memories
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/")}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Chat
            </button>
          </div>

          {/* Create Memory Form */}
          <div className="bg-gray-700 rounded-lg p-4">
            <textarea
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              placeholder="What would you like to remember?"
              className="w-full bg-gray-600 text-white p-3 rounded border border-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleCreateMemory}
                disabled={isCreating || !newMemoryContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {isCreating ? "Creating..." : "Create Memory"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Memories List */}
      <div className="max-w-4xl mx-auto p-6">
        {memories.length === 0 ? (
          <div className="text-center py-20">
            <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold mb-2">No memories yet</h2>
            <p className="text-gray-400 mb-6">
              Create your first memory to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Your Memories</h2>
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {editingId === memory.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                          rows={4}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateMemory(memory.id)}
                            disabled={!editContent.trim() || isUpdating}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            {isUpdating ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-white whitespace-pre-wrap mb-3">
                          {memory.text}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          {memory.last_modified && (
                            <span>
                              Updated {formatDate(memory.last_modified)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {editingId !== memory.id && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                      <button
                        onClick={() => startEditing(memory)}
                        className="text-gray-400 hover:text-blue-400 p-1"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="text-gray-400 hover:text-red-400 p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
