import Fastify from "fastify";
import cors from "@fastify/cors";
import type { RAG } from "./rag/rag.ts";

export interface RestApiConfig {
  port: number;
  host: string;
  corsOrigins: string[];
}

export interface RestApiConstructorParams {
  rag: RAG;
}

export class RestApiServer {
  private fastify: any;
  private rag: RAG;

  constructor(params: RestApiConstructorParams) {
    this.rag = params.rag;
    this.fastify = Fastify({
      logger: true,
    });
  }

  async initialize(config: RestApiConfig): Promise<void> {
    // Configure CORS
    await this.fastify.register(cors, {
      origin: config.corsOrigins,
      credentials: true,
    });

    // Register memories REST endpoints
    this.registerMemoriesRoutes();

    // Start the server
    await this.fastify.listen({
      port: config.port,
      host: config.host,
    });

    console.log(
      `Fastify server listening at http://${config.host}:${config.port}`
    );
  }

  private registerMemoriesRoutes(): void {
    // GET /api/memories - List all memories
    this.fastify.get("/api/memories", async (request: any, reply: any) => {
      try {
        const memories = await this.rag.listMemories();
        return { status: "ok", result: memories };
      } catch (error) {
        reply.code(500);
        return { status: "error", error: (error as Error).message };
      }
    });

    // GET /api/memories/:id - Get specific memory
    this.fastify.get("/api/memories/:id", async (request: any, reply: any) => {
      try {
        const { id } = request.params as { id: string };
        const memoryId = parseInt(id);
        if (isNaN(memoryId)) {
          reply.code(400);
          return { status: "error", error: "Invalid memory ID" };
        }
        const memory = await this.rag.getMemory(memoryId);
        if (!memory) {
          reply.code(404);
          return { status: "error", error: "Memory not found" };
        }
        return { status: "ok", result: memory };
      } catch (error) {
        reply.code(500);
        return { status: "error", error: (error as Error).message };
      }
    });

    // POST /api/memories - Create new memory
    this.fastify.post("/api/memories", async (request: any, reply: any) => {
      try {
        const { content } = request.body as { content: string };
        if (!content || content.trim() === "") {
          reply.code(400);
          return { status: "error", error: "Content is required" };
        }
        const memory = await this.rag.createMemory(content.trim());
        return { status: "ok", result: memory };
      } catch (error) {
        reply.code(500);
        return { status: "error", error: (error as Error).message };
      }
    });

    // PUT /api/memories/:id - Update memory
    this.fastify.put("/api/memories/:id", async (request: any, reply: any) => {
      try {
        const { id } = request.params as { id: string };
        const { content } = request.body as { content: string };
        const memoryId = parseInt(id);
        if (isNaN(memoryId)) {
          reply.code(400);
          return { status: "error", error: "Invalid memory ID" };
        }
        if (!content || content.trim() === "") {
          reply.code(400);
          return { status: "error", error: "Content is required" };
        }
        const memory = await this.rag.updateMemory(memoryId, content.trim());
        if (!memory) {
          reply.code(404);
          return { status: "error", error: "Memory not found" };
        }
        return { status: "ok", result: memory };
      } catch (error) {
        reply.code(500);
        return { status: "error", error: (error as Error).message };
      }
    });

    // DELETE /api/memories/:id - Delete memory
    this.fastify.delete(
      "/api/memories/:id",
      async (request: any, reply: any) => {
        try {
          const { id } = request.params as { id: string };
          const memoryId = parseInt(id);
          if (isNaN(memoryId)) {
            reply.code(400);
            return { status: "error", error: "Invalid memory ID" };
          }
          const deleted = await this.rag.deleteMemory(memoryId);
          if (!deleted) {
            reply.code(404);
            return { status: "error", error: "Memory not found" };
          }
          return { status: "ok", result: "Memory deleted" };
        } catch (error) {
          reply.code(500);
          return { status: "error", error: (error as Error).message };
        }
      }
    );
  }

  async close(): Promise<void> {
    await this.fastify.close();
  }
}
