"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit3,
  MoreVertical,
  Calendar,
  Clock,
  RefreshCw,
} from "lucide-react";
import { StoredConversation } from "../types";

interface ConversationsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: StoredConversation[];
  currentConversationId: string | null;
  onCreateConversation: () => void;
  onSelectConversation: (conversation: StoredConversation) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, name: string) => void;
  onRefreshConversations: () => void;
  isLoading: boolean;
}

export function ConversationsSidebar({
  isOpen,
  onToggle,
  conversations,
  currentConversationId,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onRefreshConversations,
  isLoading,
}: ConversationsSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );

  const handleEditStart = (conversation: StoredConversation) => {
    setEditingId(conversation.id);
    setEditingName(conversation.name);
  };

  const handleEditSave = async (id: string) => {
    if (editingName.trim()) {
      await onRenameConversation(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = async (id: string) => {
    await onDeleteConversation(id);
    setShowDeleteConfirm(null);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-700 transition-transform duration-300 z-40 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "350px" }}
      >
        <div className="p-4 h-full flex flex-col">
          {/* Header */}
          <div className="mb-6 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Conversations</h2>
              <button
                onClick={onRefreshConversations}
                disabled={isLoading}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Refresh conversations"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <button
              onClick={onCreateConversation}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-gray-400 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p>No conversations yet</p>
                <p className="text-sm">
                  Start a new conversation to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                      currentConversationId === conversation.id
                        ? "bg-blue-600/20 border border-blue-500/30"
                        : "bg-gray-800 hover:bg-gray-700 border border-transparent"
                    }`}
                    onClick={() => onSelectConversation(conversation)}
                  >
                    {/* Conversation Content */}
                    <div className="flex-1 min-w-0">
                      {editingId === conversation.id ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleEditSave(conversation.id);
                              } else if (e.key === "Escape") {
                                handleEditCancel();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSave(conversation.id);
                            }}
                            className="text-green-400 hover:text-green-300 text-sm"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCancel();
                            }}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-white truncate">
                              {conversation.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(conversation.updated_at)}</span>
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(conversation.updated_at)}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {conversation.messages.length} messages
                            </p>
                          </div>

                          {/* Actions Menu */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditStart(conversation);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Rename conversation"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(conversation.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete conversation"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Delete Confirmation */}
                    {showDeleteConfirm === conversation.id && (
                      <div className="absolute inset-0 bg-red-900/90 rounded-lg flex items-center justify-center gap-2 p-2">
                        <span className="text-red-200 text-xs">Delete?</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(conversation.id);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Yes
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(null);
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="text-xs text-gray-500 text-center">
              {conversations.length} conversation
              {conversations.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
}
