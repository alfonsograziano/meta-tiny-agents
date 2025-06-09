# Meta Tiny Agents

A simple experimental framework for building LLM-based autonomous agents using OpenAI's tool use APIs and the Model Context Protocol (MCP). This project is a playground to explore multiple agentic patterns (ReAct, Plan-and-Execute, etc.) and see what's possible with minimal, hackable code.

## Getting Started

### Install dependencies

```bash
npm install
```

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your-key-here
```

## Run the Agent

This runs a sample agent goal with tool usage and user interaction:

```bash
npm start
```

The agent will:

- Generate a system prompt using a Prompt Designer agent
- Register and use tools (including MCP clients)
- Ask follow-up questions if needed
- Complete the task using LLM + tools

## Register a Tool

You can register a tool server using the MCP protocol:

```ts
await agent
  .getClientsRegistry()
  .register(
    "stdio",
    "hello-world",
    "node",
    ["./test/fixtures/helloWorldServer.js"],
    { PATH: process.env.PATH }
  );
```

## Example Goal

Inside `index.ts`:

```ts
const goal = "Design a workout routine for a beginner with no equipment.";
```

This gets passed to the Prompt Designer and used to generate the main agent's system prompt.

---

This is not a production library. It's a space to learn, build, and iterate fast.
