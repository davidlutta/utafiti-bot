import dotenv from "dotenv";
dotenv.config();

import { runJob } from "./orchestrator";
import "./agents/web-search";
import "./agents/data-analyst";
import "./agents/synthesiser";

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.log("Usage: npx ts-node src/main.ts \"your question here\"");
    process.exit(1);
  }

  console.log(`\n[main] query: "${query}"\n`);
  await runJob(query);
}

main();