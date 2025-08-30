"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Command } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onCommand: (command: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  onCommand,
  disabled = false,
  placeholder = "Ask anything...",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isCommandMode, setIsCommandMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;

    if (isCommandMode) {
      // Remove the leading slash for commands
      const command = input.trim().replace(/^\//, "");
      onCommand(command);
      setIsCommandMode(false);
    } else {
      onSendMessage(input.trim());
    }

    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    } else if (e.key === "/" && !input) {
      e.preventDefault();
      setIsCommandMode(true);
      setInput("/");
    } else if (e.key === "Escape") {
      setIsCommandMode(false);
      setInput("");
    }
  };

  const toggleCommandMode = () => {
    setIsCommandMode(!isCommandMode);
    if (!isCommandMode) {
      setInput("/");
    } else {
      setInput("");
    }
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  return (
    <div className="border-t border-gray-700 bg-gray-900 p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1 relative">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={toggleCommandMode}
              className={`p-1 rounded transition-colors ${
                isCommandMode
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-300 hover:bg-gray-700"
              }`}
              title="Toggle command mode"
            >
              <Command className="w-4 h-4" />
            </button>
            {isCommandMode && (
              <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-1 rounded">
                Command Mode
              </span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCommandMode ? "Enter command..." : placeholder}
            className={`w-full resize-none rounded-lg border bg-gray-800 text-white placeholder-gray-400 p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isCommandMode ? "border-blue-500" : "border-gray-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            rows={1}
            disabled={disabled}
          />
        </div>

        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-3 rounded-lg transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>

      <div className="mt-2 text-xs text-gray-500">
        {isCommandMode ? (
          <span>
            Available commands: help, list_tools, generate_recipe,
            get_full_conversation, start_browser
          </span>
        ) : (
          <span>Press / for commands • Shift+Enter for new line</span>
        )}
      </div>
    </div>
  );
}
