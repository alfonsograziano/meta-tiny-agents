"use client";

import { ChatProvider } from "../contexts/ChatContext";
import { Chat } from "../components/Chat";

export default function Home() {
  return (
    <ChatProvider>
      <Chat />
    </ChatProvider>
  );
}
