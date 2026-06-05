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

2. Create a `.env` file and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your-key-here
   ```

## Usage

```bash
npx ts-node src/main.ts "your question here"
```

**Example:**
```bash
npx ts-node src/main.ts "What are the latest trends in renewable energy?"
```
