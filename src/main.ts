import dotenv from "dotenv";
dotenv.config();

import { runJob } from "./orchestrator";
import { logger } from "./logger";
import "./agents/web-search";
import "./agents/data-analyst";
import "./agents/synthesiser";
import * as readline from "readline";
import { addToMemory } from "./memory";

async function main() {
  console.log("\n[utafiti-bot] ready. Type your research question below.");
  console.log("[utafiti-bot] press Ctrl+C to exit.\n");

  const args = process.argv.slice(2);
  const isVerbose = args.includes("--verbose");
  const isQuiet = args.includes("--quiet");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.prompt();

  rl.on("line", async (input) => {
    const query = input.trim();

    if (!query) {
      rl.prompt();
      return;
    }

    logger.output(`\nQuery: "${query}"\n`);

    await runJob(query, async (report: string) => {
      await addToMemory(query, report);
      rl.prompt();
    });
  });

  rl.on("close", () => {
    console.log("\n[utafiti-bot] goodbye.");
    process.exit(0);
  });
}

main();
