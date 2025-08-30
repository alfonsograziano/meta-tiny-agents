import { Server } from "socket.io";
import { TinyAgent } from "./tinyAgents.js";
import { OpenAI } from "openai";
import { getProfileDir, getWorkspaceDir } from "./utils.js";
import { printLogo, printSystemMessage } from "./cli.ts";
import { agentConfig } from "./config.js";
import { RAG } from "./rag/rag.ts";
import { getRecipePrompt } from "./prompts.ts";
import type { ToolCall } from "./clientsRegistry.ts";

const PORT = 3000;
const io = new Server(PORT);

//TODO: Fix this - load properly the API key
const API_KEY = agentConfig.baseURL?.includes("google")
  ? process.env.GEMINI_API_KEY!
  : process.env.OPENAI_API_KEY!;

const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: agentConfig.baseURL,
});

const agent = new TinyAgent({
  maxInteractions: agentConfig.maxToolcallsPerInteraction,
});

printLogo();

printSystemMessage("Welcome to Tiny Agent - let's get started!");
printSystemMessage("Agent config: " + JSON.stringify(agentConfig, null, 2));
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
  agent
    .getClientsRegistry()
    .register("stdio", "smart-fetch", "npm", ["run", "start-smart-fetch-mcp"], {
      PATH: process.env.PATH!,
    })
    .then(() => {
      console.log("[MCP]: Smart Fetch client initialized");
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

  socket.on(
    "generate-answer",
    async (
      input: {
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        ragQueries: string[];
      },
      callback
    ) => {
      let streamedContent = "";
      let onStreamAnswer = undefined;

      if (agentConfig.enableStreaming) {
        onStreamAnswer = (chunk: string) => {
          socket.emit("stream-answer", chunk);
          streamedContent += chunk;
        };
      }

      const result = await agent.run({
        openai,
        baseMessages: input.messages,
        ragQueries: input.ragQueries,
        model: agentConfig.model,
        onStreamAnswer,
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
            content:
              result.conversation[result.conversation.length - 1].content,
            streamed: false,
          },
        });
      } else {
        callback({
          status: "ok",
          result: {
            content:
              result.conversation[result.conversation.length - 1].content,
            streamed: true,
          },
        });
      }
    }
  );

  socket.on(
    "generate-recipe",
    async (
      input: {
        conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
      },
      callback
    ) => {
      const recipe = await agent.run({
        openai,
        baseMessages: [
          {
            role: "system",
            content: getRecipePrompt(),
          },
          {
            role: "user",
            content:
              "Generate the recipe for the task given the full conversation with the agent so far: " +
              JSON.stringify(input, null, 2),
          },
        ],
        model: agentConfig.model,
      });
      const recipeContent = recipe.conversation[recipe.conversation.length - 1]
        .content as string;
      await rag.indexText(recipeContent);

      callback({ status: "ok", result: recipeContent });
    }
  );

  socket.on(
    "generate-rag-queries",
    async (
      input: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      callback
    ) => {
      const queries = await agent.generateRAGQueries({
        openai,
        messages: input,
        model: agentConfig.helperModel,
      });

      callback({ status: "ok", result: queries });
    }
  );

  socket.on("call-tool", async (input: { toolCall: ToolCall }, callback) => {
    const result = await agent.getClientsRegistry().callTool(input.toolCall);
    callback({ status: "ok", result });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});
