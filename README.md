# Utafiti Bot

A multi-agent research assistant that breaks down a question into sub-tasks, runs them in parallel across specialised agents, and synthesises the results into a single answer.

**Agents:**

- **WebSearch** — searches the web for relevant information
- **DataAnalyst** — interprets and analyses quantitative data
- **Synthesiser** — combines all results into a final response

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file and add your OpenAI API and Brave API Key keys:
   ```
   OPENAI_API_KEY=your-key-here
   BRAVE_API_KEY=your-key-here
   ```

## Usage

Start the bot in interactive mode:

```bash
npx ts-node src/main.ts [--verbose | --quiet]
```

Once running, type any research question at the `>` prompt and press Enter. The bot will process it and print the final report. You can ask multiple questions in the same session — the bot remembers previous research and uses it as context for follow-up queries. Press `Ctrl+C` to exit.

| Flag | Output |
|---|---|
| *(none)* | Key lifecycle events — agent started/done, search queries, job progress, final report |
| `--verbose` | Everything above plus bus traffic, raw payloads, and token counts |
| `--quiet` | Final report only |

**Examples:**

```bash
npx ts-node src/main.ts
npx ts-node src/main.ts --verbose
npx ts-node src/main.ts --quiet
```
