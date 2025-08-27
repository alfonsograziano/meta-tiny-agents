import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const INTERACTION_SERVER = "interaction-server";

/**
 * Shape of a tool as returned by clients
 * (each client’s listTools() returns an array of tools with at least
 * name, description, and inputSchema).
 */
export interface ClientTool {
  name: string;
  description?: string;
  inputSchema: any; //TODO: Fix this
}

/**
 * The “available tool” type that getTools() will return.
 */
export interface AvailableTool {
  clientName: string;
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: any; //TODO: Fix this
  };
}

/**
 * Shape of a tool call, matching how LLMs invoke function‐style tools:
 * { function: { name: string; arguments?: string } }
 */
export interface ToolCall {
  function: {
    name: string;
    arguments?: string;
  };
}

export class ClientsRegistry {
  private clients: Record<string, Client> = {};

  // Default tools that always exist, pointing at the INTERACTION_SERVER client
  private readonly defaultTools: AvailableTool[] = [
    {
      clientName: INTERACTION_SERVER,
      type: "function",
      function: {
        name: "task_complete",
        description:
          "Call this tool when the task given by the user is complete",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    // {
    //   clientName: INTERACTION_SERVER,
    //   type: "function",
    //   function: {
    //     name: "ask_question",
    //     description:
    //       "Ask a question to the user to get more info required to solve or clarify their problem.",
    //     parameters: {
    //       type: "object",
    //       properties: {
    //         questions: {
    //           type: "string",
    //           description:
    //             "The question(s) to ask the user to gather more information.",
    //         },
    //       },
    //       required: ["questions"],
    //     },
    //   },
    // },
  ];

  /**
   * Register a new MCP‐based server under the given name, using the specified transport.
   */
  public async register(
    transportType: string, //TODO: Support StreamableHTTPClientTransport
    name: string,
    command: string,
    args: string[],
    env: Record<string, string>
  ): Promise<void> {
    let transport;
    if (transportType === "stdio") {
      transport = new StdioClientTransport({
        command,
        args,
        env,
        stderr: "pipe",
      });

      if (transport.stderr) {
        transport.stderr.on("data", () => {
          // no-op: silently discard logs
        });
      }
    } else {
      throw new Error(`Unsupported transport type: ${transportType}`);
    }

    const client = new Client({ name, version: "1.0.0" });
    await client.connect(transport);
    this.clients[name] = client;
  }

  /**
   * Returns the full list of available tools: the two default interaction‐server tools
   * plus every tool exposed by each registered client.
   */
  public async getTools(): Promise<AvailableTool[]> {
    const toolsByClient = await Promise.all(
      Object.entries(this.clients).map(async ([clientName, client]) => {
        const { tools }: { tools: ClientTool[] } = await client.listTools();
        return { clientName, tools };
      })
    );

    const availableToolsFromClients: AvailableTool[] = toolsByClient.flatMap(
      ({ clientName, tools }) =>
        tools.map((tool) => ({
          clientName,
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        }))
    );

    return [...this.defaultTools, ...availableToolsFromClients];
  }

  public async getClientsNames(): Promise<string[]> {
    return Object.keys(this.clients);
  }

  /**
   * Invokes a tool call. It finds which registered client exposes the given function name,
   * parses the JSON arguments, and calls client.callTool().
   *
   * @param toolCall  - an object of shape { function: { name, arguments } }
   * @returns         - whatever the underlying client.callTool(...) returns
   */
  public async callTool(toolCall: ToolCall): Promise<any> {
    const functionName = toolCall.function.name;
    const argsObject = JSON.parse(toolCall.function.arguments ?? "{}");

    // Re‐query the available tools to find which clientName owns this function
    const allTools = await this.getTools();
    const matching = allTools.find((t) => t.function.name === functionName);
    if (!matching) {
      throw new Error(
        `Tool "${functionName}" not found among registered clients.`
      );
    }

    if (matching.clientName === INTERACTION_SERVER) {
      // Special case for built-in tools that are not registered as clients
      return;
    }

    const client = this.clients[matching.clientName];
    if (!client) {
      throw new Error(`Client "${matching.clientName}" is not registered.`);
    }

    return client.callTool({
      name: functionName,
      arguments: argsObject,
    });
  }

  public async closeClient(name: string): Promise<void> {
    const client = this.clients[name];
    if (!client) {
      throw new Error(`Client "${name}" is not registered.`);
    }
    await client.close();
  }

  public async cleanup(): Promise<void> {
    await Promise.all(
      Object.keys(this.clients).map((key) => this.closeClient(key))
    );
  }
}
