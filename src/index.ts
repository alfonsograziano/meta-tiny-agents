import { TinyAgent } from "./tinyAgents.js";
import { OpenAI } from "openai";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Create a TinyAgent instance
const agent = new TinyAgent({});

// Register the "hello-world" tool using the test server script
const HELLO_SERVER_PATH = path.resolve(
  __dirname,
  "..",
  "test",
  "fixtures",
  "helloWorldServer.js"
);
await agent.registry.register(
  "stdio", // Use the stdio transport
  "hello-world", // Tool name
  "node", // Runtime
  [HELLO_SERVER_PATH], // Path to the server script
  { PATH: process.env.PATH! }
);

const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "system", content: "You are a helpful assistant." },
  {
    role: "user",
    content:
      'Please use the hello-world tool to say "Hello, Mario!" as a greeting to my friend.',
  },
];

const result = await agent.run({
  openai,
  baseMessages,
});
console.log("RESULT:", JSON.stringify(result, null, 2));
process.exit(0);
