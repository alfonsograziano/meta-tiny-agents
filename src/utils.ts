import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

export const getContext = async () => {
  // Load all the MD files in the context folder
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const contextDir = path.resolve(__dirname, "../context");
  const files = await fs.readdir(contextDir);
  const mdFiles = files.filter((file) => file.endsWith(".md"));
  // Load the content of the MD files
  const context = await Promise.all(
    mdFiles.map(async (file) => {
      const content = await fs.readFile(path.resolve(contextDir, file), "utf8");
      return {
        file,
        content,
      };
    })
  );
  return context;
};

export const getContextString = async () => {
  const context = await getContext();
  return context.map((item) => `# ${item.file}\n${item.content}`).join("\n");
};

export const getProfileDir = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../profiles/.main-profile");
};

export const getWorkspaceDir = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../workspace");
};
