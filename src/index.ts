import { TinyAgent } from "./tinyAgents.js";
import { OpenAI } from "openai";
import path from "path";
import {
  getContextString,
  getProfileDir,
  getWorkspaceDir,
  input,
} from "./utils.js";
import fs from "fs";

const goal = await input("How can I help you today?");
const context = await getContextString();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Create a TinyAgent instance
const agent = new TinyAgent({
  maxInteractions: 50,
});

await agent
  .getClientsRegistry()
  .register(
    "stdio",
    "playwright",
    "npx",
    ["@playwright/mcp@latest", "--user-data-dir=" + (await getProfileDir())],
    {
      PATH: process.env.PATH!,
    }
  );

await agent
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
  );

await agent
  .getClientsRegistry()
  .register(
    "stdio",
    "filesystem",
    "npx",
    ["-y", "@modelcontextprotocol/server-filesystem", await getWorkspaceDir()],
    {
      PATH: process.env.PATH!,
    }
  );

// const systemPrompt = await agent.generateSystemPrompt({
//   openai,
//   goal: `
//     Context:
//     ${context}

//     Goal:
//     ${goal}
//     `,
// });
const systemPrompt = `You are a helpful assistant`;

const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "system", content: systemPrompt },
  {
    role: "user",
    content: `
    Context:
    ${context}

    Goal:
    ${goal}
    `,
  },
];

const result = await agent.run({
  openai,
  baseMessages,
  requestInputFromUser: input,
});

// Save the result to a /results/new Date.json file
const resultsDir = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../results"
);
const resultsFile = path.resolve(
  resultsDir,
  `${new Date().toISOString()}.json`
);
fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
await agent.getClientsRegistry().cleanup();

process.exit(0);
