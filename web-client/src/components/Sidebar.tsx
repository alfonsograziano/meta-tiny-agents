"use client";

import React from "react";
import {
  Wrench,
  MessageSquare,
  Trash2,
  BookOpen,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tool } from "../types";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  tools: Tool[];
  onCommand: (command: string) => void;
  onClearConversation: () => void;
  messageCount: number;
}

export function Sidebar({
  isOpen,
  onToggle,
  tools,
  onCommand,
  onClearConversation,
  messageCount,
}: SidebarProps) {
  const groupedTools = tools.reduce((acc, tool) => {
    if (!acc[tool.clientName]) {
      acc[tool.clientName] = [];
    }
    acc[tool.clientName].push(tool);
    return acc;
  }, {} as Record<string, Tool[]>);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition-colors"
        title={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? (
          <ChevronLeft className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5" />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-700 transition-transform duration-300 z-40 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "320px" }}
      >
        <div className="p-4 h-full flex flex-col">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Tiny Agents</h2>
            <div className="text-sm text-gray-400">
              {messageCount} messages in conversation
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => onCommand("help")}
                className="w-full text-left p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Help
              </button>
              <button
                onClick={() => onCommand("list_tools")}
                className="w-full text-left p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <Wrench className="w-4 h-4" />
                List Tools
              </button>
              <button
                onClick={() => onCommand("generate_recipe")}
                className="w-full text-left p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Generate Recipe
              </button>
              <button
                onClick={() => onCommand("start_browser")}
                className="w-full text-left p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Start Browser
              </button>
            </div>
          </div>

          {/* Tools */}
          <div className="flex-1 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
              Available Tools ({tools.length})
            </h3>
            <div className="space-y-3">
              {Object.entries(groupedTools).map(([clientName, clientTools]) => (
                <div key={clientName} className="bg-gray-800 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-400 mb-2">
                    {clientName}
                  </h4>
                  <div className="space-y-2">
                    {clientTools.map((tool, index) => (
                      <div
                        key={index}
                        className="text-xs text-gray-300 bg-gray-700 p-2 rounded"
                      >
                        <div className="font-mono text-blue-300">
                          {tool.function.name}
                        </div>
                        <div className="text-gray-400 mt-1">
                          {tool.function.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <button
              onClick={onClearConversation}
              className="w-full p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-300 hover:text-red-200 transition-colors flex items-center gap-2 justify-center"
            >
              <Trash2 className="w-4 h-4" />
              Clear Conversation
            </button>
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
