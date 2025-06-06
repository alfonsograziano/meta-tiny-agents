import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export async function askQuestions(questions: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question("\n" + questions + "\n Answer here:", (input) => {
      resolve(input.trim());
    });
  });
}
