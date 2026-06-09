import { messageBus, AgentMessage } from "./message-bus";
import dotenv from "dotenv";
import { COMPLETED_STATUS, DATA_ANALYST_NAME, ERROR_TYPE, MODEL_NAME, ORCHESTRATOR_NAME, PENDING_STATUS, RESULT_TYPE, SYNTHESIZER_NAME, TASK_TYPE, WEB_SEARCH_NAME } from "./Constants";
import { client } from "./client";
import { ORCHESTRATOR_PROMPT } from "./prompts/Orchestrator.prompt";
import { logger } from "./logger";
import { getMemoryContext } from "./memory";
import { searchWeb } from "./tools/search-tool";

dotenv.config();

/** Structure of a sub-task for tracking purposes and what agent is responsible for it. */
interface SubTask {
    taskId: string;
    agentType: string;
    query: string;
    status: typeof PENDING_STATUS | typeof RESULT_TYPE | typeof ERROR_TYPE | typeof COMPLETED_STATUS;
    result?: string;
}

/** Registry to track original queries and their associated sub-tasks. */
interface JobRegistry {
    originalQuery: string;
    subTasks: SubTask[];
}

const jobs = new Map<string, JobRegistry>();

/**
 * Sends the user query to the model and parses its response into a list of sub-tasks.
 * @param query - The original user query to decompose.
 * @returns An array of sub-tasks, each assigned to a specific agent type.
 */
async function decomposeUserQuery(query: string): Promise<SubTask[]> {
    const memoryContext = getMemoryContext();

    logger.info(`[memory] context length: ${memoryContext.length} chars`);

    const response = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            {
                role: "system",
                content: `${ORCHESTRATOR_PROMPT}\n\n
                ${memoryContext ? `Previous research context:\n${memoryContext}` : "No previous research context available."}`
            },
            { role: "user", content: query },
        ],
    });

    const firstChoice = response.choices[0];
    if (!firstChoice) throw new Error("No choices returned from model");

    const content = firstChoice.message.content ?? "[]";
    const parsed = JSON.parse(content) as { agentType: string; query: string }[];

    return parsed.map((item) => ({
        taskId: "",
        agentType: item.agentType,
        query: item.query,
        status: PENDING_STATUS,
    }));
};

/**
 * Dispatches each sub-task to its target agent via the message bus.
 * @param jobId - The parent job identifier used to namespace each task ID.
 * @param subTasks - The sub-tasks to distribute across agents.
 * each sub task runs parallel but we are introducing a new sequential fan-out
 * with dependancy pattern to allow us to collect web search results before the 
 * data-analyst agent is called
 */
async function fanOutSubTasks(jobId: string, subTasks: SubTask[]): Promise<void> {
    const webSearchTasks = subTasks.filter((t) => t.agentType === WEB_SEARCH_NAME);
    const dataAnalystTasks = subTasks.filter((t) => t.agentType === DATA_ANALYST_NAME);

    const otherTasks = subTasks.filter((t) => t.agentType !== WEB_SEARCH_NAME && t.agentType !== DATA_ANALYST_NAME);

    // Step 1: run web search and collect results
    const webSearchResults: string[] = [];
    await Promise.allSettled(
        webSearchTasks.map(async (task, index) => {
            task.taskId = `${jobId}:${task.agentType}:${index}`;
            const result = await searchWeb(task.query);
            webSearchResults.push(result);
            task.status = COMPLETED_STATUS;
            task.result = result;
            logger.info(`[${ORCHESTRATOR_NAME}] web-search direct result collected`);
        })
    );

    // If all sub-tasks were web-search (no data-analyst or other tasks)
    // trigger synthesis immediately since no bus results are coming
    const job = jobs.get(jobId);
    if (job) {
        const allDone = job.subTasks.every(
            (t) => t.status === COMPLETED_STATUS || t.status === ERROR_TYPE
        );

        if (allDone) {
            logger.info(`[${ORCHESTRATOR_NAME}] all tasks completed in wave 1 — synthesising`);
            triggerSynthesis(jobId, job);
        }
    }

    // Step 2: start the data-analyst with grounded web results injected
    const groundedContext = webSearchResults.join("\n\n");
    dataAnalystTasks.forEach((task, index) => {
        task.taskId = `${jobId}:${task.agentType}:${webSearchTasks.length + index}`;

        messageBus.publish(task.agentType, {
            taskId: task.taskId,
            fromAgent: ORCHESTRATOR_NAME,
            toAgent: task.agentType,
            type: TASK_TYPE,
            payload: {
                query: task.query,
                groundedContext
            },
            timestamp: Date.now(),
        })
    });

    // Step 3: do everything else in parallel.
    otherTasks.forEach((task, index) => {
        task.taskId = `${jobId}:${task.agentType}:${webSearchTasks.length + dataAnalystTasks.length + index}`;

        messageBus.publish(task.agentType, {
            taskId: task.taskId,
            fromAgent: ORCHESTRATOR_NAME,
            toAgent: task.agentType,
            type: TASK_TYPE,
            payload: { query: task.query },
            timestamp: Date.now()
        });
    });
}

/**
 * Handles a RESULT or ERROR message returned by an agent.
 * Updates the sub-task status and triggers synthesis when all sub-tasks are finished.
 * @param message - The incoming result or error message from an agent.
 */
function handleResult(message: AgentMessage): void {
    const [jobId] = message.taskId.split(":");

    if (!jobId) throw new Error(`Invalid taskId: ${message.taskId}`);

    const job = jobs.get(jobId);
    if (!job) throw new Error(`No job found for jobId: ${jobId}`);

    const subTask = job.subTasks.find((t) => t.taskId === message.taskId);
    if (!subTask) throw new Error(`No sub-task found for taskId: ${message.taskId}`);

    subTask.status = message.type === RESULT_TYPE ? COMPLETED_STATUS : ERROR_TYPE;
    subTask.result = String(message.payload);

    // Count as finished even if one agent errors — avoids the job getting stuck waiting forever.
    // Collect what's available and move on to synthesis.
    const allDone = job.subTasks.every(
        (t) => t.status === COMPLETED_STATUS || t.status === ERROR_TYPE
    );

    if (allDone) {
        triggerSynthesis(jobId, job);
    }
}

/**
 * Collects results from completed sub-tasks and forwards them to the synthesizer agent.
 * Errored sub-tasks are excluded from the synthesis payload.
 * @param jobId - The job identifier, used to namespace the synthesizer task.
 * @param job - The job registry entry containing the original query and sub-tasks.
 */
function triggerSynthesis(jobId: string, job: JobRegistry): void {
    const results = job.subTasks
        .filter((task) => task.status === COMPLETED_STATUS)
        .map((task) => `[${task.agentType}]: ${task.result}`)
        .join("\n\n");

    logger.info(`[${ORCHESTRATOR_NAME}] all agents done — synthesising`);
    logger.verbose(`[${ORCHESTRATOR_NAME}] synthesis input:\n${results}`);

    messageBus.publish(SYNTHESIZER_NAME, {
        taskId: `${jobId}:${SYNTHESIZER_NAME}`,
        fromAgent: ORCHESTRATOR_NAME,
        toAgent: SYNTHESIZER_NAME,
        type: TASK_TYPE,
        payload: {
            originalQuery: job.originalQuery,
            results
        },
        timestamp: Date.now(),
    });
}

/**
 * Entry point for running a job. Decomposes the query into sub-tasks, registers the job,
 * and fans out tasks to the appropriate agents.
 * @param query - The user query to process.
 */
export async function runJob(
    query: string,
    onComplete: (report: string) => Promise<void>
): Promise<void> {
    const jobId = `job_${Date.now()}`;
    logger.info(`[${ORCHESTRATOR_NAME}] starting job | query: "${query}"`);
    logger.verbose(`[${ORCHESTRATOR_NAME}] jobId: ${jobId}`);

    const handler = async (message: AgentMessage) => {
        if (message.fromAgent === SYNTHESIZER_NAME) {
            logger.output("\n[FINAL REPORT]\n");
            logger.output(String(message.payload) + "\n\n");

            messageBus.unsubscribe(ORCHESTRATOR_NAME, handler);

            await onComplete(String(message.payload));
            return;
        }
        handleResult(message);
    }

    messageBus.subscribe(ORCHESTRATOR_NAME, handler);

    const subTasks = await decomposeUserQuery(query);
    logger.info(`[${ORCHESTRATOR_NAME}] decomposed into ${subTasks.length} sub-task(s)`);

    // Register the job before fanning out so results that arrive quickly have a place to land.
    jobs.set(jobId, {
        originalQuery: query,
        subTasks,
    });

    fanOutSubTasks(jobId, subTasks);
}
