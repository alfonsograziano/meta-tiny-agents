"use client";

import React, { useState } from "react";
import { ChevronDown, Wrench, CheckCircle, Clock } from "lucide-react";

interface ToolCallAccordionProps {
  toolName: string;
  toolCallId: string;
  arguments: string;
  type: "call" | "result";
  durationMs?: number;
  result?: unknown;
  params?: unknown;
  startTime?: number;
  endTime?: number;
}

export function ToolAccordion({
  toolName,
  toolCallId,
  arguments: args,
  type,
  durationMs,
  result,
  params,
  startTime,
  endTime,
}: ToolCallAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getTitle = () => {
    if (type === "call") {
      return `Tool ${toolName} called...`;
    } else {
      return `Tool ${toolName} completed in ${durationMs || 0}ms`;
    }
  };

  const getIcon = () => {
    if (type === "call") {
      return <Wrench className="w-5 h-5 text-blue-400" />;
    } else {
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    }
  };

  const getStatusIcon = () => {
    if (type === "call") {
      return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
    } else {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getContent = () => {
    if (type === "call") {
      return (
        <div className="space-y-4 p-4 bg-gray-750 border-t border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-semibold text-gray-300 block mb-2">
                Tool Call ID
              </span>
              <div className="text-xs font-mono text-gray-400 bg-gray-800 p-3 rounded-lg border border-gray-700">
                {toolCallId}
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-300 block mb-2">
                Tool Name
              </span>
              <div className="text-sm text-blue-300 font-medium">
                {toolName}
              </div>
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold text-gray-300 block mb-2">
              Arguments
            </span>
            <div className="text-xs font-mono text-gray-400 bg-gray-800 p-3 rounded-lg border border-gray-700 max-h-32 overflow-y-auto">
              {args}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-4 p-4 bg-gray-750 border-t border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-semibold text-gray-300 block mb-2">
                Tool Call ID
              </span>
              <div className="text-xs font-mono text-gray-400 bg-gray-800 p-3 rounded-lg border border-gray-700">
                {toolCallId}
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-300 block mb-2">
                Duration
              </span>
              <div className="text-sm text-green-300 font-medium">
                {durationMs || 0}ms
              </div>
            </div>
          </div>

          {startTime && endTime && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-semibold text-gray-300 block mb-2">
                  Start Time
                </span>
                <div className="text-sm text-gray-300">
                  {formatTimestamp(startTime)}
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-300 block mb-2">
                  End Time
                </span>
                <div className="text-sm text-gray-300">
                  {formatTimestamp(endTime)}
                </div>
              </div>
            </div>
          )}

          {params !== null && params !== undefined && (
            <div>
              <span className="text-sm font-semibold text-gray-300 block mb-2">
                Parameters
              </span>
              <div className="text-xs font-mono text-gray-400 bg-gray-800 p-3 rounded-lg border border-gray-700 max-h-32 overflow-y-auto">
                {String(params)}
              </div>
            </div>
          )}

          <div>
            <span className="text-sm font-semibold text-gray-300 block mb-2">
              Result
            </span>
            <div className="text-xs font-mono text-gray-400 bg-gray-800 p-3 rounded-lg border border-gray-700 max-h-48 overflow-y-auto">
              {String(result)}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg mb-4 shadow-lg hover:border-gray-600 transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-750 transition-colors duration-200 rounded-lg"
      >
        <div className="flex items-center gap-3">
          {getIcon()}
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-gray-200">
              {getTitle()}
            </span>
            <div className="flex items-center gap-2 mt-1">
              {getStatusIcon()}
              <span className="text-xs text-gray-400">
                {type === "call" ? "In progress..." : "Completed"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`text-xs px-2 py-1 rounded-full ${
              type === "call"
                ? "bg-yellow-900/30 text-yellow-300 border border-yellow-700/50"
                : "bg-green-900/30 text-green-300 border border-green-700/50"
            }`}
          >
            {type === "call" ? "CALLING" : "COMPLETED"}
          </div>
          <div
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {getContent()}
      </div>
    </div>
  );
}
