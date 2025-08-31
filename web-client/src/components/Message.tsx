"use client";

import React, { useMemo, useCallback } from "react";
import { ConversationMessage } from "../types";
import { User, Bot, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CopyButton } from "./CopyButton";

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
  // Memoize the markdown components to prevent recreation on every render
  const markdownComponents = useMemo(() => {
    const CodeComponent = React.memo(
      ({
        node,
        inline,
        className,
        children,
        ...props
      }: {
        node?: unknown;
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
      }) => {
        const match = /language-(\w+)/.exec(className || "");
        const language = match ? match[1] : "text";

        return !inline ? (
          <div className="relative group -m-4">
            <CopyButton content={String(children)} />
            <SyntaxHighlighter
              language={language}
              style={oneDark}
              customStyle={{
                margin: 0,
                borderRadius: "0.5rem",
                border: "1px solid #374151",
              }}
              showLineNumbers={false}
              wrapLines={false}
            >
              {String(children)}
            </SyntaxHighlighter>
          </div>
        ) : (
          <code className="bg-gray-700 px-1 py-0.5 rounded text-sm" {...props}>
            {children}
          </code>
        );
      }
    );
    CodeComponent.displayName = "CodeComponent";

    const H1Component = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <h1 className="text-xl font-bold text-white mb-3" {...props}>
          {children}
        </h1>
      )
    );
    H1Component.displayName = "H1Component";

    const H2Component = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <h2 className="text-lg font-bold text-white mb-2" {...props}>
          {children}
        </h2>
      )
    );
    H2Component.displayName = "H2Component";

    const H3Component = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <h3 className="text-base font-bold text-white mb-2" {...props}>
          {children}
        </h3>
      )
    );
    H3Component.displayName = "H3Component";

    const UlComponent = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <ul className="list-disc list-inside space-y-1 mb-3" {...props}>
          {children}
        </ul>
      )
    );
    UlComponent.displayName = "UlComponent";

    const OlComponent = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <ol className="list-decimal list-inside space-y-1 mb-3" {...props}>
          {children}
        </ol>
      )
    );
    OlComponent.displayName = "OlComponent";

    const AComponent = React.memo(
      ({
        children,
        href,
        ...props
      }: {
        children?: React.ReactNode;
        href?: string;
      }) => (
        <a
          href={href}
          className="text-blue-400 hover:text-blue-300 underline"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      )
    );
    AComponent.displayName = "AComponent";

    const BlockquoteComponent = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <blockquote
          className="border-l-4 border-gray-600 pl-4 italic text-gray-300 mb-3"
          {...props}
        >
          {children}
        </blockquote>
      )
    );
    BlockquoteComponent.displayName = "BlockquoteComponent";

    const TableComponent = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <div className="overflow-x-auto mb-3">
          <table
            className="min-w-full border-collapse border border-gray-600"
            {...props}
          >
            {children}
          </table>
        </div>
      )
    );
    TableComponent.displayName = "TableComponent";

    const ThComponent = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <th
          className="border border-gray-600 px-3 py-2 bg-gray-700 text-left font-semibold"
          {...props}
        >
          {children}
        </th>
      )
    );
    ThComponent.displayName = "ThComponent";

    const TdComponent = React.memo(
      ({ children, ...props }: { children?: React.ReactNode }) => (
        <td className="border border-gray-600 px-3 py-2" {...props}>
          {children}
        </td>
      )
    );
    TdComponent.displayName = "TdComponent";

    return {
      code: CodeComponent,
      h1: H1Component,
      h2: H2Component,
      h3: H3Component,
      ul: UlComponent,
      ol: OlComponent,
      a: AComponent,
      blockquote: BlockquoteComponent,
      table: TableComponent,
      th: ThComponent,
      td: TdComponent,
    };
  }, []);

  // Memoize the markdown detection to avoid recalculating on every render
  const markdownInfo = useMemo(() => {
    if (!message.content) return { hasMarkdown: false, hasCodeBlocks: false };

    const hasMarkdown = /[#*`\[\]()>|]/.test(message.content);
    const hasCodeBlocks = /```[\s\S]*```/.test(message.content);

    return { hasMarkdown, hasCodeBlocks };
  }, [message.content]);

  // Memoize the markdown content rendering
  const markdownContent = useMemo(() => {
    if (!markdownInfo.hasMarkdown && !markdownInfo.hasCodeBlocks) return null;

    return (
      <div className="relative">
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse" />
          )}
        </div>
      </div>
    );
  }, [
    message.content,
    markdownInfo.hasMarkdown,
    markdownInfo.hasCodeBlocks,
    markdownComponents,
    isStreaming,
  ]);

  // Memoize the regular text content
  const textContent = useMemo(() => {
    if (!message.content) return null;

    return (
      <div className="whitespace-pre-wrap">
        {message.role !== "tool" && message.content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse" />
        )}
      </div>
    );
  }, [message.content, message.role, isStreaming]);

  const getMessageIcon = useCallback(() => {
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
  }, [message.role]);

  const getMessageStyle = useCallback(() => {
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
  }, [message.role]);

  const renderToolCalls = useCallback(() => {
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
  }, [message.tool_calls]);

  const renderToolResult = useCallback(() => {
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
  }, [message.role, message.tool_call_id, message.content]);

  const renderContent = useCallback(() => {
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
      // Return memoized content based on markdown detection
      if (markdownInfo.hasMarkdown || markdownInfo.hasCodeBlocks) {
        return markdownContent;
      } else {
        return textContent;
      }
    }

    return null;
  }, [
    message.tool_calls,
    message.content,
    isGenerating,
    isGeneratingRAG,
    markdownInfo.hasMarkdown,
    markdownInfo.hasCodeBlocks,
    markdownContent,
    textContent,
    renderToolCalls,
  ]);

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
