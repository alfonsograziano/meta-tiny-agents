import { Server } from "socket.io";
import { TinyAgent } from "./tinyAgents.js";
import { OpenAI } from "openai";
import { getProfileDir, getWorkspaceDir } from "./utils.js";
import { printLogo, printSystemMessage } from "./cli.ts";
import { agentConfig } from "./config.js";
import { RAG } from "./rag/rag.ts";
import { getRecipePrompt } from "./prompts.ts";
import type { ToolCall } from "./clientsRegistry.ts";
import { ConversationsStorage } from "./conversationsStorage.js";
import { OpenAIEmbedder } from "./rag/embedders/OpenAIEmbedder.ts";
import { TextAdapter } from "./rag/adapters/TextAdapter.ts";
import { PdfAdapter } from "./rag/adapters/PdfAdapter.ts";
import { PostgresVectorStore } from "./rag/storage/PostgresVectorStore.ts";
import { Pool } from "pg";
import { RestApiServer } from "./restApi.js";

const PORT = 3000;
const REST_PORT = 3002;

const io = new Server(PORT, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

//TODO: Fix this - load properly the API key
const API_KEY = agentConfig.baseURL?.includes("google")
  ? process.env.GEMINI_API_KEY!
  : process.env.OPENAI_API_KEY!;

const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: agentConfig.baseURL,
});

const filesystemIndexingConfig = agentConfig.rag.filesystemIndexing;
const defaultAdapters = [new TextAdapter(), new PdfAdapter()];

const filesystemIndexing = filesystemIndexingConfig
  ? {
      workspaceDir: filesystemIndexingConfig.workspaceDir,
      adapters: defaultAdapters,
    }
  : undefined;

const rag = new RAG({
  embedder: new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY ?? "" }),
  filesystemIndexing,
  vectorStore: new PostgresVectorStore(
    new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "password",
      database: process.env.POSTGRES_DB ?? "ragdb",
    })
  ),
  textSplitter: agentConfig.rag.textSplitter,
  logsAllowed: true,
});

const agent = new TinyAgent({
  maxInteractions: agentConfig.maxToolcallsPerInteraction,
  rag,
});

// Initialize conversations storage
const conversationsStorage = new ConversationsStorage();

printLogo();

printSystemMessage("Welcome to Tiny Agent - let's get started!");
printSystemMessage("Agent config: " + JSON.stringify(agentConfig, null, 2));
printSystemMessage("--------------------------------");
printSystemMessage("Initializing MCP clients...");

// Generate a realistic user-agent (desktop Chrome) like in browser.ts
const ua =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const customMcpServers = Object.entries(agentConfig.mcpServers || {}).map(
  ([name, server]) => {
    return agent
      .getClientsRegistry()
      .register("stdio", name, server.command, server.args, {
        ...server.env,
        PATH: process.env.PATH!,
      });
  }
);

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
  ...customMcpServers.map((server) =>
    server.then(({ name }) => {
      console.log(`[MCP]: ${name} client initialized`);
    })
  ),
];

const start = Date.now();
await Promise.all(clients);
const elapsedTime = (Date.now() - start) / 1000;
printSystemMessage(`MCP clients initialized in ${elapsedTime.toFixed(2)}s\n\n`);

printSystemMessage(`Syncing RAG in the background...`);

const startRag = Date.now();

await rag.sync();

printSystemMessage(`RAG synced in ${(Date.now() - startRag) / 1000}s\n\n`);

rag.listenForChanges();

printSystemMessage(
  `Server is running on port ${PORT}. You can now start client with "npm run start-client"`
);

// Initialize and start REST API server
const restApiServer = new RestApiServer({ rag });
await restApiServer.initialize({
  port: REST_PORT,
  host: "0.0.0.0",
  corsOrigins: ["http://localhost:3001", "http://localhost:3000"],
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("list-tools", async (input, callback) => {
    const tools = await agent.getClientsRegistry().getTools();
    callback({ status: "ok", result: tools });
  });

  // Conversation management events
  socket.on(
    "create-conversation",
    async (input: { name?: string }, callback) => {
      try {
        const conversation = await conversationsStorage.createConversation(
          input.name
        );
        callback({ status: "ok", result: conversation });
      } catch (error) {
        callback({ status: "error", error: (error as Error).message });
      }
    }
  );

  socket.on("list-conversations", async (input, callback) => {
    try {
      const conversations = await conversationsStorage.listConversations();
      callback({ status: "ok", result: conversations });
    } catch (error) {
      callback({ status: "error", error: (error as Error).message });
    }
  });

  socket.on("get-conversation", async (input: { id: string }, callback) => {
    try {
      const conversation = await conversationsStorage.getConversation(input.id);
      if (!conversation) {
        callback({ status: "error", error: "Conversation not found" });
        return;
      }
      callback({ status: "ok", result: conversation });
    } catch (error) {
      callback({ status: "error", error: (error as Error).message });
    }
  });

  socket.on("delete-conversation", async (input: { id: string }, callback) => {
    try {
      await conversationsStorage.deleteConversation(input.id);
      callback({ status: "ok", result: "Conversation deleted" });
    } catch (error) {
      callback({ status: "error", error: (error as Error).message });
    }
  });

  socket.on(
    "rename-conversation",
    async (input: { id: string; name: string }, callback) => {
      try {
        await conversationsStorage.renameConversation(input.id, input.name);
        callback({ status: "ok", result: "Conversation renamed" });
      } catch (error) {
        callback({ status: "error", error: (error as Error).message });
      }
    }
  );

  socket.on(
    "generate-answer",
    async (
      input: {
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        ragQueries: string[];
        conversationId?: string;
      },
      callback
    ) => {
      // Update conversation with the new messages from the user
      // So that if the user disconnects, we can continue from the last message
      if (input.conversationId) {
        await conversationsStorage.updateConversation(
          input.conversationId,
          input.messages
        );
      }

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

      const lastMessageContent =
        result.conversation[result.conversation.length - 1].content;
      const content =
        typeof lastMessageContent === "string"
          ? lastMessageContent
          : JSON.stringify(lastMessageContent);

      // Update conversation with the new message from the agent
      // And the tool usages
      if (input.conversationId) {
        await conversationsStorage.updateConversation(
          input.conversationId,
          result.conversation
        );
      }

      if (!streamedContent) {
        callback({
          status: "ok",
          result: {
            content,
            streamed: false,
          },
        });
      } else {
        callback({
          status: "ok",
          result: {
            content,
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
      await rag.createMemory(recipeContent);

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

  socket.on(
    "generate-plan",
    async (
      input: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      callback
    ) => {
      const plan = await agent.generatePlan({
        openai,
        messages: input,
        model: agentConfig.model,
      });
      callback({ status: "ok", result: plan });
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
