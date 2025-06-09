import { TinyAgent } from "./tinyAgents.js";
import { OpenAI } from "openai";
import { fileURLToPath } from "url";
import path from "path";
import { askQuestions } from "./utils.ts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Create a TinyAgent instance
const agent = new TinyAgent({});

const goal = "Design a workout routine for a beginner with no equipment.";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HELLO_SERVER_PATH = path.resolve(
  __dirname,
  "..",
  "test",
  "fixtures",
  "helloWorldServer.js"
);
await agent
  .getClientsRegistry()
  .register("stdio", "hello-world", "node", [HELLO_SERVER_PATH], {
    PATH: process.env.PATH!,
  });

const systemPrompt = await agent.generateSystemPrompt({
  openai,
  goal,
});

console.log("Generated System Prompt:\n", systemPrompt);

const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "system", content: systemPrompt },
  {
    role: "user",
    content: goal,
  },
];

const result = await agent.run({
  openai,
  baseMessages,
  requestInputFromUser: askQuestions,
});
console.log("RESULT:", JSON.stringify(result, null, 2));
process.exit(0);
