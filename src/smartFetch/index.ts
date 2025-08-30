import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const server = new McpServer(
  {
    name: "Smart fetch",
    version: "1.0.0",
    description: "Smart fetch server able to fetch data from the web",
  },
  {
    capabilities: {
      logging: {},
      tools: {},
    },
  }
);

export const smartFetchSchema = {
  urls: z
    .array(z.string())
    .describe(
      "List of webpage URLs to fetch and convert into clean, LLM-friendly text."
    ),
};

export const fetchUrlLLMFriendly = async (url: string) => {
  const html = await fetch(url).then((r) => r.text());
  // give Readability a real URL context so relatives can be resolved later
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article) return null;

  let contentHtml = article.content;
  if (!contentHtml) return null;

  // Make all <a href> absolute so Markdown links aren’t broken
  const contentDom = new JSDOM(contentHtml, { url });
  contentDom.window.document.querySelectorAll("a[href]").forEach((a) => {
    try {
      const href = a.getAttribute("href");
      if (href !== null) {
        (a as HTMLAnchorElement).href = new URL(href, url).toString();
      }
    } catch {}
  });
  contentHtml = contentDom
    .serialize()
    .replace(
      /^<!DOCTYPE html><html><head><\/head><body>|<\/body><\/html>$/g,
      ""
    );

  // Convert to Markdown (Turndown keeps links by default)
  const td = new TurndownService({ linkStyle: "inlined" });
  const markdown = td.turndown(contentHtml);

  return {
    ...article,
    markdown,
    url,
  };
};

// Configure server tools and resources
server.tool(
  "smart_fetch",
  "Fetch and extract clean, LLM-optimized text content from webpages given their URLs.",
  smartFetchSchema,
  async (params) => {
    const { urls } = params;
    const results = await Promise.all(urls.map(fetchUrlLLMFriendly));
    const validResults = results.filter((result) => result !== null);
    return {
      content: validResults.map((result) => ({
        type: "text",
        text: JSON.stringify(result.markdown),
      })),
      structuredContent: {
        results: validResults,
      },
    };
  }
);

server.connect(new StdioServerTransport());
