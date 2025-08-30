"use client";

import React from "react";
import { ConversationMessage } from "../types";
import { User, Bot, Wrench } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface MessageProps {
  message: ConversationMessage;
  isStreaming?: boolean;
  isGenerating?: boolean;
  isGeneratingRAG?: boolean;
}

export function Message({
  message,
  isStreaming = false,
  isGenerating = false,
  isGeneratingRAG = false,
}: MessageProps) {
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

  const renderToolCalls = () => {
    if (!message.tool_calls || message.tool_calls.length === 0) return null;

    return (
      <Accordion type="multiple" className="w-full">
        {message.tool_calls.map((toolCall, index) => (
          <AccordionItem key={index} value={`tool-call-${index}`}>
            <AccordionTrigger className="text-left hover:no-underline">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">
                  Tool {toolCall.function.name} called...
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div>
                  <span className="text-xs text-gray-400 block mb-1">
                    Arguments:
                  </span>
                  <div className="text-xs text-gray-300 font-mono bg-gray-700 p-2 rounded border border-gray-600">
                    {toolCall.function.arguments}
                  </div>
                </div>
                {toolCall.id && (
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">
                      Tool Call ID:
                    </span>
                    <div className="text-xs text-gray-300 font-mono bg-gray-700 p-2 rounded border border-gray-600">
                      {toolCall.id}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderToolResult = () => {
    if (message.role !== "tool") return null;

    return (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="tool-result">
          <AccordionTrigger className="text-left hover:no-underline">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium">
                Tool {message.tool_call_id || "unknown"} completed
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              {message.tool_call_id && (
                <div>
                  <span className="text-xs text-gray-400 block mb-1">
                    Tool Call ID:
                  </span>
                  <div className="text-xs text-gray-300 font-mono bg-gray-700 p-2 rounded border border-gray-600">
                    {message.tool_call_id}
                  </div>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-400 block mb-1">
                  Result:
                </span>
                <div className="text-xs text-gray-300 font-mono bg-gray-700 p-2 rounded border border-gray-600 max-h-32 overflow-y-auto">
                  {message.content || "No content"}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderContent = () => {
    // Handle tool calls (when assistant is calling tools)
    if (message.tool_calls && message.tool_calls.length > 0) {
      return renderToolCalls();
    }

    if (isGenerating) {
      return (
        <div className="flex items-center gap-2 text-gray-300">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          <span>
            {isGeneratingRAG
              ? "Searching for relevant information..."
              : "Generating your answer..."}
          </span>
        </div>
      );
    }

    if (message.content) {
      return (
        <div className="whitespace-pre-wrap">
          {message.role !== "tool" && message.content}
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
        {message.role === "tool" && renderToolResult()}
      </div>

      {message.role === "user" && (
        <div className="flex-shrink-0 mt-1">{getMessageIcon()}</div>
      )}
    </div>
  );
}
