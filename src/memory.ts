import { encodingForModel } from "js-tiktoken";
import { client } from "./client";
import { MODEL_NAME, SYSTEM_NAME, USER_NAME, MAX_HISTORY_TOKENS } from "./Constants";
import { MEMORY_COMPRESSION_PROMPT } from "./prompts/memory-compression.prompt";
import { logger } from "./logger";

const encoder = encodingForModel(MODEL_NAME);

interface ConversationMessage {
    query: string;
    report: string;
}

interface MemoryStore {
    summary: string | null;
    messages: ConversationMessage[];
}

const store: MemoryStore = {
    summary: null,
    messages: [],
};

/**
 * Counts the number of tokens in a string using the model's tokeniser.
 * @param text - The text to tokenise.
 * @returns The token count.
 */
function countTokens(text: string): number {
    const encoded = encoder.encode(text);
    return encoded.length;
}

/**
 * Sums the token count across the current summary and all buffered messages.
 * @returns Total token count of the in-memory store.
 */
function getTotalTokens() {
    let total = 0;

    if (store.summary) {
        total += countTokens(store.summary);
    }

    for (const message of store.messages) {
        total += countTokens(message.query);
        total += countTokens(message.report);
    }
    return total;
};

/**
 * Sends the buffered message history (and any existing summary) to the model
 * to produce a compressed summary, then clears the message buffer.
 * Called automatically when the token limit is exceeded.
 */
async function CompressMemory(): Promise<void> {
    const textHistory = store.messages
        .map((msg) => `User Query: ${msg.query}\nAgent Report: ${msg.report}`)
        .join("\n\n");

    const contentToSummarise = store.summary
        ? `Existing Summary:\n${store.summary}\n\nNew Conversations:\n${textHistory}`
        : textHistory;

    const response = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            {
                role: SYSTEM_NAME,
                content: MEMORY_COMPRESSION_PROMPT
            },
            { role: USER_NAME, content: contentToSummarise },
        ]
    });

    const choice = response.choices[0];
    if (!choice) throw new Error("No choices returned from model");

    store.summary = choice.message.content ?? "";
    store.messages = [];
};

/**
 * Appends a completed query/report pair to memory and triggers compression
 * if the total token count exceeds {@link MAX_HISTORY_TOKENS}.
 * called after evey job is completed to add the new information to memory for future context.
 * @param query - The user's original query.
 * @param report - The final synthesised report produced by the agents.
 */
export async function addToMemory(
    query: string,
    report: string
): Promise<void> {
    store.messages.push({ query, report });

    const totalTokens = getTotalTokens();
    if (totalTokens > MAX_HISTORY_TOKENS) {
        logger.info(`[MemoryStore] token limit exceeded (${totalTokens} tokens) — compressing memory`);
        logger.verbose("[MemoryStore] Context threshold exceeded - compressing history.");
        await CompressMemory();
        logger.info(`[MemoryStore] compression complete. Current summary tokens: ${countTokens(store.summary ?? "")}`);
        logger.verbose("[MemoryStore] Compression complete.");
    }
}

/**
 * Builds and returns a formatted string of the current memory context —
 * the compressed summary (if any) followed by recent uncompressed messages.
 * Returns an empty string if there is nothing in memory yet.
 * it is called by the orchestrator. when constructing the context for a new job, to provide relevant background knowledge from past interactions.
 */
export function getMemoryContext(): string {
    if (!store.summary && store.messages.length === 0) {
        logger.info("[MemoryStore] no memory to include in context");
        return "";
    }

    const contextParts: string[] = [];

    if (store.summary) {
        contextParts.push(`Summary of past research:\n${store.summary}`);
    }

    for (const message of store.messages) {
        contextParts.push(`User Query: ${message.query}\nAgent Report: ${message.report}`);
    }

    return contextParts.join("\n\n");
}
