import { styleText } from "node:util";
import readline from "readline";

// Built with https://patorjk.com/software/taag/ using the "ANSI Shadow" font
export const logo = `
████████╗██╗███╗   ██╗██╗   ██╗     █████╗  ██████╗ ███████╗███╗   ██╗████████╗
╚══██╔══╝██║████╗  ██║╚██╗ ██╔╝    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
   ██║   ██║██╔██╗ ██║ ╚████╔╝     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
   ██║   ██║██║╚██╗██║  ╚██╔╝      ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
   ██║   ██║██║ ╚████║   ██║       ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
   ╚═╝   ╚═╝╚═╝  ╚═══╝   ╚═╝       ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   `;

export const printLogo = () => {
  printSystemMessage(logo);
};

export const printSystemMessage = (message: string) => {
  console.log(styleText("blue", message));
};

export const printUserMessage = (message: string) => {
  console.log(styleText("green", message));
};

export const printAgentMessage = (message: string) => {
  console.log(styleText("green", message));
};

export const printMcpMessage = (message: string) => {
  console.log(styleText("yellow", message));
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export async function promptUser(
  text: string,
  answerPrompt: string = "Answer here: "
): Promise<{
  command?: string;
  input: string;
}> {
  return new Promise((resolve) => {
    rl.question("\n" + text + "\n" + answerPrompt, (input) => {
      const inputSanitized = input.trim();
      if (inputSanitized.startsWith("/")) {
        const command = inputSanitized.split("/")[1];
        if (availableCommands.includes(command)) {
          const commandObj = commands.find((c) => c.name === command);
          if (commandObj) {
            return resolve({
              command,
              input: inputSanitized,
            });
          }
        }
      }
      resolve({
        input: inputSanitized,
      });
    });
  });
}

export const commands = [
  {
    name: "exit",
    description: "Exit the program",
  },
  {
    name: "help",
    description: "Show the help and all the available commands",
  },
  {
    name: "list_tools",
    description: "List all the available tools exposed through the MCP",
  },
];

export const availableCommands = commands.map((command) => command.name);

export const getAvailableCommandsString = () =>
  commands
    .map((command) => `/${command.name} - ${command.description}`)
    .join("\n");
