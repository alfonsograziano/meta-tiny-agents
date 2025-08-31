import { Pool } from "pg";
import { type ConversationMessage } from "./tinyAgents.js";

export type Conversation = {
  id: string;
  name: string;
  messages: ConversationMessage[];
  created_at: Date;
  updated_at: Date;
};

export type Env = {
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
};

export class ConversationsStorage {
  private pool: Pool;

  constructor(env: Env = process.env as Env) {
    this.pool = new Pool({
      host: env.PGHOST ?? "localhost",
      port: Number(env.PGPORT ?? 5432),
      user: env.PGUSER ?? "postgres",
      password: env.PGPASSWORD ?? "password",
      database: env.PGDATABASE ?? "ragdb",
    });
  }

  /**
   * Create a new conversation with a default name
   */
  async createConversation(name?: string): Promise<Conversation> {
    const conversationName = name || new Date().toISOString();

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO conversations (name, messages) VALUES ($1, $2) RETURNING *`,
        [conversationName, JSON.stringify([])]
      );

      return this.mapDbRowToConversation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM conversations WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToConversation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get list of all conversations
   */
  async listConversations(): Promise<Conversation[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM conversations ORDER BY updated_at DESC`
      );

      return result.rows.map((row) => this.mapDbRowToConversation(row));
    } finally {
      client.release();
    }
  }

  /**
   * Update the entire conversation (useful for bulk updates)
   */
  async updateConversation(
    conversationId: string,
    messages: ConversationMessage[]
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Ensure messages is an array
      const messagesArray = Array.isArray(messages) ? messages : [];
      await client.query(
        `UPDATE conversations SET messages = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(messagesArray), conversationId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`DELETE FROM conversations WHERE id = $1`, [
        conversationId,
      ]);
    } finally {
      client.release();
    }
  }

  /**
   * Rename a conversation
   */
  async renameConversation(
    conversationId: string,
    newName: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE conversations SET name = $1, updated_at = NOW() WHERE id = $2`,
        [newName, conversationId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Helper method to map database row to Conversation object
   */
  private mapDbRowToConversation(row: any): Conversation {
    // Ensure messages is always an array
    let messages: ConversationMessage[] = [];
    if (row.messages) {
      // If messages is a string, parse it as JSON
      if (typeof row.messages === "string") {
        try {
          messages = JSON.parse(row.messages);
        } catch (error) {
          console.error("Failed to parse messages JSON:", error);
          messages = [];
        }
      } else if (Array.isArray(row.messages)) {
        // If it's already an array, use it directly
        messages = row.messages;
      } else {
        // If it's something else, try to convert it
        console.warn("Unexpected messages format:", typeof row.messages);
        messages = [];
      }
    }

    return {
      id: row.id,
      name: row.name,
      messages,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
