import { z } from "zod";
import fs from "fs";

const configSchema = z.object({
  systemPrompt: z.string(),
  maxToolcallsPerInteraction: z.number(),
  model: z.string(),
  // Useful if you need to use a reasoning or powerful model as the main one
  // But you want to keep a smaller model for things like chat title generation or
  // other non-critical tasks
  helperModel: z.string().optional(),
  baseURL: z.string().optional(),
  enableStreaming: z.boolean().optional().default(false),
  // Whether to perform RAG queries at each interaction
  performRAGQueries: z.boolean().optional().default(false),

  // RAG configuration
  rag: z.object({
    filesystemIndexing: z
      .object({
        workspaceDir: z.string(),
      })
      .optional(),
    textSplitter: z.object({
      strategy: z.string(),
      options: z.object({
        chunkSize: z.number(),
        chunkOverlapPercentage: z.number(),
      }),
    }),
  }),
  mcpServers: z
    .record(
      z.object({
        command: z.string(),
        args: z.array(z.string()),
        env: z.record(z.string(), z.string()).optional(),
      })
    )
    .optional(),
});

const partialAgentConfig = configSchema.parse(
  JSON.parse(fs.readFileSync("agent.json", "utf8"))
);

export const agentConfig = {
  ...partialAgentConfig,
  // Helper model defaults to the same model as the main model if not specified
  helperModel: partialAgentConfig.helperModel ?? partialAgentConfig.model,
};
