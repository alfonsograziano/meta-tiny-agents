import {
  getAvailableCommandsString,
  printAgentMessage,
  printLogo,
  printMcpMessage,
  printSystemMessage,
  promptUser,
} from "./cli.ts";
import { io, Socket } from "socket.io-client";
import { agentConfig } from "./config.ts";
import { getContextString } from "./utils.ts";
import { type ToolCall } from "./clientsRegistry.ts";
import type {
  ConversationMessage,
  Plan,
  ToolCallResult,
} from "./tinyAgents.ts";
import { spawn } from "child_process";

type SocketEventResult<T> = {
  status: string;
  result: T;
};

printLogo();
printSystemMessage("Welcome in Tiny Agent client in planner mode...");

// This planner mode has been heavily inspired by: https://docs.google.com/document/d/1flxKGrbnF2g8yh3F-oVD5Xx7ZumId56HbFpIiPdkqLI/edit?tab=t.0#heading=h.fxiksssjx6aj
// If you want to learn more: https://www.promptingguide.ai/techniques/prompt_chaining

async function connectToServer(url: string, opts: any = {}): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      ...opts,
      autoConnect: false, // prevents automatic immediate connect
    });

    socket.on("connect", () => {
      resolve(socket);
    });

    socket.on("connect_error", (err) => {
      reject(err);
    });

    // Optionally handle reconnection failure:
    socket.on("reconnect_failed", () => {
      reject(new Error("Reconnection failed"));
    });

    socket.connect(); // start the connection attempt
  });
}

let socket: Socket | null = null;

try {
  socket = await connectToServer("http://localhost:3000");

  const socketEmitPromisified = <T>(
    event: string,
    data: any
  ): Promise<SocketEventResult<T>> => {
    return new Promise((resolve) => {
      socket?.emit(event, data, (response: SocketEventResult<T>) => {
        resolve(response);
      });
    });
  };
  const context = await getContextString();

  let baseMessages: ConversationMessage[] = [
    { role: "system", content: agentConfig.systemPrompt },
    {
      role: "user",
      content: `
      Context:
      ${context}`,
    },
  ];

  socket.on("stream-answer", (chunk: string) => {
    process.stdout.write(chunk);
  });

  socket.on("tool-call", (toolCall: ToolCall) => {
    baseMessages.push({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments || "{}",
          },
        },
      ],
    });
    printMcpMessage(
      `The agent is calling the tool ${toolCall.function.name}\n`
    );
  });

  socket.on("tool-call-result", (toolCallResult: ToolCallResult) => {
    baseMessages.push({
      role: "tool",
      content: JSON.stringify(toolCallResult.result),
      tool_call_id: toolCallResult.toolCallId,
      type: "function_call_output",
    });
    printMcpMessage(
      `${toolCallResult.toolName} completed in ${(
        toolCallResult.durationMs / 1000
      ).toFixed(2)}s\n`
    );
  });

  const { input, command } = await promptUser("Ask me anything", ">> ");
  const startPlanGeneration = Date.now();
  printSystemMessage("Generating a plan...");

  const { result: plan } = await socketEmitPromisified<Plan>("generate-plan", [
    {
      role: "user",
      content: input,
    },
  ]);
  const elapsedTimePlanGeneration = (Date.now() - startPlanGeneration) / 1000;
  printSystemMessage(
    `Plan generated in ${elapsedTimePlanGeneration.toFixed(2)}s`
  );
  printSystemMessage("Plan generated:");
  printAgentMessage(JSON.stringify(plan, null, 2));

  baseMessages.push({ role: "user", content: input });
  printSystemMessage("Implementing the plan...");

  baseMessages.push({
    role: "assistant",
    content: `This is the plan generated to accomplish the task: ${JSON.stringify(
      plan
    )}`,
  });

  for (const step of plan.steps) {
    printSystemMessage(
      "Implementing step " + step.step_number + " of the plan..."
    );
    const start = Date.now();

    const currentSystemPrompt = step.system_prompt;
    const currentUserPrompt = step.user_prompt;

    const conversation = [
      ...baseMessages,
      {
        role: "user",
        content: `You are executing step ${step.step_number} of the plan.
        This is what you have to do: ${currentUserPrompt}`,
      },
    ];
    // Updating the system prompt to reflect the prompt of the current step of the plan
    conversation.find((message) => message.role === "system")!.content =
      currentSystemPrompt;

    //TODO CALL THE LLM
    const { result: answer } = await socketEmitPromisified<{
      content: string;
      streamed: boolean;
    }>("generate-answer", {
      messages: conversation,
    });
    baseMessages.push({ role: "assistant", content: answer.content });

    const elapsedTime = (Date.now() - start) / 1000;

    if (!answer.streamed) {
      printAgentMessage(answer.content);
      printSystemMessage(
        `Answer for step ${step.step_number} generated in ${elapsedTime.toFixed(
          2
        )}s`
      );
    } else {
      console.log("\n"); //Empty new line
      printSystemMessage(
        `Answer for step ${step.step_number} generated in ${elapsedTime.toFixed(
          2
        )}s`
      );
    }
  }

  //Reset system prompt to the original system prompt
  baseMessages.find((message) => message.role === "system")!.content =
    agentConfig.systemPrompt;

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
        const { result: tools } = await socketEmitPromisified<
          {
            clientName: string;
            function: { name: string; description: string };
          }[]
        >("list-tools", "");
        const clients = [...new Set(tools.map((tool) => tool.clientName))];

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
      if (command === "generate_recipe") {
        const { input: continueGeneratingRecipe } = await promptUser(
          "I will generate a recipe to accomplish the task givent the current conversation, do you want to continue? (y/n) ",
          ">> "
        );
        if (continueGeneratingRecipe !== "y") {
          continue;
        }
        printSystemMessage("Generating recipe...");
        const { result: recipe } = await socketEmitPromisified<string>(
          "generate-recipe",
          baseMessages
        );
        printSystemMessage("Recipe generated:");
        printAgentMessage(recipe);
        continue;
      }
      if (command === "get_full_conversation") {
        printSystemMessage(JSON.stringify(baseMessages, null, 2));
        continue;
      }
      if (command === "start_browser") {
        printSystemMessage("Starting browser...");
        const child = spawn("npm", ["run", "start-browser"], {
          stdio: "ignore",
          detached: true,
        });
        child.unref();
        continue;
      }
    } else {
      baseMessages.push({ role: "user", content: input });
      printSystemMessage("Generating answer...");
      const start = Date.now();

      let ragQueries: string[] = [];
      if (agentConfig.performRAGQueries) {
        printSystemMessage("Generating RAG queries...");
        const result = await socketEmitPromisified<string[]>(
          "generate-rag-queries",
          baseMessages
        );
        ragQueries = result.result;
        printSystemMessage("RAG queries generated. Building your answer...");
      }

      const { result: answer } = await socketEmitPromisified<{
        content: string;
        streamed: boolean;
      }>("generate-answer", {
        messages: baseMessages,
        ragQueries,
      });

      const elapsedTime = (Date.now() - start) / 1000;
      if (!answer.streamed) {
        printAgentMessage(answer.content);
        printSystemMessage(`Answer generated in ${elapsedTime.toFixed(2)}s`);
      } else {
        console.log("\n"); //Empty new line
        printSystemMessage(`Answer generated in ${elapsedTime.toFixed(2)}s`);
      }
      baseMessages.push({ role: "assistant", content: answer.content });
    }
  }
} catch (error) {
  console.log(error);
  printSystemMessage("Server is not running...");
  const { input: result } = await promptUser(
    "Do you want to start it now? (y/n) ",
    ">> "
  );
  if (result === "y") {
    // Start server with npm run start-server
    const child = spawn("npm", ["run", "start-server"], {
      stdio: "inherit",
      detached: true,
    });

    // Unref the child process so it can run independently
    child.unref();

    // Exit the current process
    process.exit(0);
  } else {
    process.exit(1);
  }
}

process.exit(0);
