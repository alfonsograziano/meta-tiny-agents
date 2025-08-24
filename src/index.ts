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

// Generate a realistic user-agent (desktop Chrome) like in browser.ts
const ua =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

await agent
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
  ragQuery: goal,
  ragResultsCount: 5,
});

// const recipe = await agent.generateRecipe({
//   openai,
//   baseMessages: result.conversation,
// });

// const recipeFile = path.resolve(
//   path.dirname(new URL(import.meta.url).pathname),
//   "../context/recipe.md"
// );
// if (!fs.existsSync(recipeFile)) {
//   fs.writeFileSync(recipeFile, "");
// }
// fs.appendFileSync(recipeFile, recipe);

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
