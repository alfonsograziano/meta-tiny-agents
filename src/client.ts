import {
  getAvailableCommandsString,
  printAgentMessage,
  printLogo,
  printMcpMessage,
  printSystemMessage,
  promptUser,
} from "./cli.ts";
import { io } from "socket.io-client";
import { agentConfig } from "./config.ts";
import { OpenAI } from "openai";
import { getContextString } from "./utils.ts";
import { type ToolCall } from "./clientsRegistry.ts";
import type { ToolCallResult } from "./tinyAgents.ts";

printLogo();
printSystemMessage("Welcome in Tiny Agent client...");

const socket = io("http://localhost:3000");

type SocketEventResult<T> = {
  status: string;
  result: T;
};

const socketEmitPromisified = <T>(
  event: string,
  data: any
): Promise<SocketEventResult<T>> => {
  return new Promise((resolve) => {
    socket.emit(event, data, (response: SocketEventResult<T>) => {
      resolve(response);
    });
  });
};
const context = await getContextString();

let baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
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
  printMcpMessage(`The agent is calling the tool ${toolCall.function.name}\n`);
});

socket.on("tool-call-result", (toolCallResult: ToolCallResult) => {
  printMcpMessage(
    `${toolCallResult.toolName} completed in ${(
      toolCallResult.durationMs / 1000
    ).toFixed(2)}s\n`
  );
});

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
      const clients = tools.map((tool) => tool.clientName);

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
  } else {
    baseMessages.push({ role: "user", content: input });
    printSystemMessage("Generating answer...");
    const start = Date.now();

    const { result: answer } = await socketEmitPromisified<{
      content: string;
      streamed: boolean;
    }>("generate-answer", baseMessages);

    const elapsedTime = (Date.now() - start) / 1000;
    if (!answer.streamed) {
      printAgentMessage(answer.content);
      printSystemMessage(`Answer generated in ${elapsedTime.toFixed(2)}s\n\n`);
    } else {
      console.log("\n"); //Empty new line
      printSystemMessage(`Answer generated in ${elapsedTime.toFixed(2)}s\n\n`);
    }
    baseMessages.push({ role: "assistant", content: answer.content });
  }
}

process.exit(0);
