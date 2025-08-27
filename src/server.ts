import { Server } from "socket.io";
import { TinyAgent } from "./tinyAgents.js";
import { OpenAI } from "openai";
import { getProfileDir, getWorkspaceDir } from "./utils.js";
import { printLogo, printSystemMessage } from "./cli.ts";
import { agentConfig } from "./config.js";
import { RAG } from "./rag/rag.ts";

const PORT = 3000;
const io = new Server(PORT);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: agentConfig.baseURL,
});

const agent = new TinyAgent({
  maxInteractions: agentConfig.maxToolcallsPerInteraction,
});

printLogo();

printSystemMessage("Welcome to Tiny Agent - let's get started!");
printSystemMessage("--------------------------------");
printSystemMessage("Initializing MCP clients...");

// Generate a realistic user-agent (desktop Chrome) like in browser.ts
const ua =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const clients = [
  agent
    .getClientsRegistry()
    .register(
      "stdio",
      "playwright",
      "npx",
      [
        "@playwright/mcp@latest",
        "--user-data-dir=" + (await getProfileDir()),
        "--browser=chrome",
        "--no-sandbox",
        "--viewport-size=1280,800",
        "--user-agent=" + ua,
        "--save-session",
      ],
      {
        PATH: process.env.PATH!,
      }
    )
    .then(() => {
      console.log("[MCP]: Playwright client initialized");
    }),
  agent
    .getClientsRegistry()
    .register(
      "stdio",
      "node-code-interpreter",
      "npx",
      ["-y", "node-code-sandbox-mcp"],
      {
        PATH: process.env.PATH!,
        FILES_DIR: await getWorkspaceDir(),
      }
    )
    .then(() => {
      console.log("[MCP]: Node Code Interpreter client initialized");
    }),
  agent
    .getClientsRegistry()
    .register(
      "stdio",
      "filesystem",
      "npx",
      [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        await getWorkspaceDir(),
      ],
      {
        PATH: process.env.PATH!,
      }
    )
    .then(() => {
      console.log("[MCP]: Filesystem client initialized");
    }),
  agent
    .getClientsRegistry()
    .register("stdio", "memory", "npm", ["run", "start-rag-mcp"], {
      PATH: process.env.PATH!,
    })
    .then(() => {
      console.log("[MCP]: RAG Memory client initialized");
    }),
];

const start = Date.now();
await Promise.all(clients);
const elapsedTime = (Date.now() - start) / 1000;
printSystemMessage(`MCP clients initialized in ${elapsedTime.toFixed(2)}s\n\n`);

printSystemMessage(`Syncing RAG in the background...`);

const startRag = Date.now();
const rag = new RAG();
rag.sync().catch(console.error);

printSystemMessage(`RAG synced in ${(Date.now() - startRag) / 1000}s\n\n`);

printSystemMessage(
  `Server is running on port ${PORT}. You can now start client with "npm run start-client"`
);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("list-tools", async (input, callback) => {
    const tools = await agent.getClientsRegistry().getTools();
    callback({ status: "ok", result: tools });
  });

  socket.on("generate-answer", async (input, callback) => {
    let streamedContent = "";

    const result = await agent.run({
      openai,
      baseMessages: input,
      model: agentConfig.model,
      onStreamAnswer: (chunk: string) => {
        socket.emit("stream-answer", chunk);
        streamedContent += chunk;
      },
      onToolCall: (toolCall) => {
        socket.emit("tool-call", toolCall);
      },
      onToolCallResult: (toolCallResult) => {
        socket.emit("tool-call-result", toolCallResult);
      },
    });

    if (!streamedContent) {
      callback({
        status: "ok",
        result: {
          content: result.conversation[result.conversation.length - 1].content,
          streamed: false,
        },
      });
    } else {
      callback({
        status: "ok",
        result: {
          content: result.conversation[result.conversation.length - 1].content,
          streamed: true,
        },
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});
