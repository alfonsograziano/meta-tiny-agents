import { chromium, type BrowserContext } from "playwright";
import { promises as fs } from "fs";
import { getProfileDir } from "./utils.js";

async function main() {
  const profileDir = await getProfileDir();

  // Ensure the directory exists
  await fs.mkdir(profileDir, { recursive: true });
  console.log(`Profile directory ready at: ${profileDir}`);

  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  // Launch Chromium with a persistent profile and anti-detection flags
  const context: BrowserContext = await chromium.launchPersistentContext(
    profileDir,
    {
      channel: "chrome",
      headless: false, // Must be headful for manual login
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-infobars",
        "--disable-extensions",
        "--start-maximized",
        "--window-size=1280,800",
      ],
      userAgent: ua.toString(),
      viewport: { width: 1280, height: 800 },
    }
  );

  // Open a page and navigate to Google Sign-In
  const page = context.pages()[0] ?? (await context.newPage());
  console.log("Browser launched.");
  await page.goto("https://google.com/");

  await page.pause();

  // Once done, close context to save session
  await context.close();
}

main().catch((err) => {
  console.error("Error in launching browser:", err);
  process.exit(1);
});
