"use client";

import React from "react";
import { ConversationMessage } from "../types";
import { User, Bot, Wrench } from "lucide-react";

interface MessageProps {
  message: ConversationMessage;
  isStreaming?: boolean;
}

export function Message({ message, isStreaming = false }: MessageProps) {
  const getMessageIcon = () => {
    switch (message.role) {
      case "user":
        return <User className="w-5 h-5 text-blue-400" />;
      case "assistant":
        return <Bot className="w-5 h-5 text-green-400" />;
      case "tool":
        return <Wrench className="w-5 h-5 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getMessageStyle = () => {
    switch (message.role) {
      case "user":
        return "bg-gray-700 text-white ml-auto max-w-[80%]";
      case "assistant":
        return "bg-gray-800 text-white mr-auto max-w-[80%]";
      case "tool":
        return "bg-yellow-900/30 text-yellow-200 mr-auto max-w-[80%] border border-yellow-700/50";
      default:
        return "bg-gray-600 text-white mr-auto max-w-[80%]";
    }
  };

  const renderContent = () => {
    if (message.tool_calls && message.tool_calls.length > 0) {
      return (
        <div className="space-y-2">
          {message.tool_calls.map((toolCall, index) => (
            <div key={index} className="bg-gray-700 p-3 rounded-lg">
              <div className="text-sm text-gray-300 mb-2">
                Calling tool:{" "}
                <span className="text-blue-400 font-mono">
                  {toolCall.function.name}
                </span>
              </div>
              <div className="text-xs text-gray-400 font-mono bg-gray-800 p-2 rounded">
                {toolCall.function.arguments}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (message.content) {
      return (
        <div className="whitespace-pre-wrap">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse" />
          )}
        </div>
      );
    }

    return null;
  };

  if (message.role === "system") {
    return null; // Don't render system messages in the UI
  }

  return (
    <div
      className={`flex items-start gap-3 mb-4 ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      {message.role !== "user" && (
        <div className="flex-shrink-0 mt-1">{getMessageIcon()}</div>
      )}

      <div className={`rounded-lg p-4 ${getMessageStyle()}`}>
        {renderContent()}
      </div>

      {message.role === "user" && (
        <div className="flex-shrink-0 mt-1">{getMessageIcon()}</div>
      )}
    </div>
  );
}
