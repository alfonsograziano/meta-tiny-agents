import { z } from "zod";
import fs from "fs";

const configSchema = z.object({
  systemPrompt: z.string(),
  maxToolcallsPerInteraction: z.number(),
  model: z.string(),
  saveConversations: z.boolean().optional().default(false),
  baseURL: z.string().optional(),
  enableStreaming: z.boolean().optional().default(false),
});

export const agentConfig = configSchema.parse(
  JSON.parse(fs.readFileSync("agent.json", "utf8"))
);
