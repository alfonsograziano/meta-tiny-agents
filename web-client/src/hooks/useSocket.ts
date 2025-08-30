"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  ConversationMessage,
  SocketEventResult,
  Tool,
  GenerateAnswerRequest,
  GenerateAnswerResponse,
} from "../types";

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to access current socket value without causing re-renders
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    setIsConnecting(true);
    setError(null);

    try {
      const newSocket = io("http://localhost:3000", {
        autoConnect: false,
      });

      newSocket.on("connect", () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      });

      newSocket.on("disconnect", () => {
        setIsConnected(false);
      });

      newSocket.on("connect_error", (err) => {
        setError(
          `Connection failed: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
        setIsConnecting(false);
      });

      newSocket.on("reconnect_failed", () => {
        setError("Reconnection failed");
        setIsConnecting(false);
      });

      newSocket.connect();
      setSocket(newSocket);
      socketRef.current = newSocket;
    } catch (err) {
      setError(
        `Failed to create socket: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setSocket(null);
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emitWithPromise = useCallback(
    <T>(event: string, data: unknown): Promise<SocketEventResult<T>> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) {
          reject(new Error("Socket not connected"));
          return;
        }

        socketRef.current.emit(
          event,
          data,
          (response: SocketEventResult<T>) => {
            resolve(response);
          }
        );
      });
    },
    []
  );

  const listTools = useCallback(async (): Promise<Tool[]> => {
    const result = await emitWithPromise<Tool[]>("list-tools", "");
    return result.result;
  }, [emitWithPromise]);

  const generateAnswer = useCallback(
    async (request: GenerateAnswerRequest): Promise<GenerateAnswerResponse> => {
      const result = await emitWithPromise<GenerateAnswerResponse>(
        "generate-answer",
        request
      );
      return result.result;
    },
    [emitWithPromise]
  );

  const generateRecipe = useCallback(
    async (messages: ConversationMessage[]): Promise<string> => {
      const result = await emitWithPromise<string>("generate-recipe", messages);
      return result.result;
    },
    [emitWithPromise]
  );

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    emitWithPromise,
    listTools,

    generateAnswer,
    generateRecipe,
  };
};
