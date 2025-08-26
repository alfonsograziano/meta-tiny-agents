import { TinyAgent } from "./tinyAgents.js";
import { OpenAI } from "openai";
import { getContextString, getProfileDir, getWorkspaceDir } from "./utils.js";
import {
  getAvailableCommandsString,
  printAgentMessage,
  printLogo,
  printSystemMessage,
  promptUser,
} from "./cli.ts";
import { agentConfig } from "./config.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
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

const context = await getContextString();

let baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "system", content: agentConfig.systemPrompt },
  {
    role: "user",
    content: `
    Context:
    ${context}`,
  },
];

while (true) {
  const { input, command } = await promptUser("Ask me anything", ">> ");

  if (command) {
    if (command === "exit") {
      break;
    }
    if (command === "help") {
      printSystemMessage(getAvailableCommandsString());
      continue;
    }
    if (command === "list_tools") {
      const tools = await agent.getClientsRegistry().getTools();
      const clients = await agent.getClientsRegistry().getClientsNames();
      printSystemMessage(
        tools
          .map(
            (tool) =>
              `[${tool.clientName}]: ${tool.function.name} - ${tool.function.description}`
          )
          .join("\n\n")
      );
      printSystemMessage(
        `You have access in total to ${tools.length} tools from ${
          clients.length
        } different clients: \n\n${clients.join(", ")}`
      );
      continue;
    }
  } else {
    baseMessages.push({ role: "user", content: input });
    printSystemMessage("Generating answer...");
  }

  const start = Date.now();

  // Create streaming callback for real-time output
  let streamedContent = "";
  const onStreamAnswer = (chunk: string) => {
    process.stdout.write(chunk);
    streamedContent += chunk;
  };

  const result = await agent.run({
    openai,
    baseMessages,
    requestInputFromUser: promptUser,
    model: agentConfig.model,
    onStreamAnswer,
  });
  const elapsedTime = (Date.now() - start) / 1000;

  // Add a newline after streaming is complete
  if (streamedContent) {
    console.log();
  }

  printSystemMessage(`Answer generated in ${elapsedTime.toFixed(2)}s\n\n`);

  const agentAnswer = result.conversation[result.conversation.length - 1];

  // Only print the final message if we didn't stream it
  if (!streamedContent) {
    printAgentMessage(agentAnswer.content as string);
  }

  baseMessages = [...result.conversation];
}

await agent.getClientsRegistry().cleanup();

process.exit(0);
