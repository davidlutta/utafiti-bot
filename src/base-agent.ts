import { OpenAI } from "openai";
import { messageBus, AgentMessage } from "./message-bus";
import { ASSISTANT_NAME, ERROR_TYPE, MODEL_NAME, ORCHESTRATOR_NAME, RESULT_TYPE, SYSTEM_NAME, TASK_TYPE, TOOL_NAME, USER_NAME } from "./Constants";
import { client } from "./client";
import { logger } from "./logger";

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    run: (args: Record<string, unknown>) => Promise<unknown>;
};


export abstract class BaseAgent {
    protected name: string;
    protected systemPrompt: string;
    protected tools: ToolDefinition[];

    /**
     * @param name - Unique agent name; used as the message bus subscription key.
     * @param systemPrompt - System-level instruction sent to the model on every call.
     * @param tools - List of tools the agent may invoke during its reasoning loop.
     */
    constructor(name: string, systemPrompt: string, tools: ToolDefinition[]) {
        this.name = name;
        this.systemPrompt = systemPrompt;
        this.tools = tools;

        messageBus.subscribe(this.name, (msg) => this.handleMessage(msg));
        logger.info(`[${this.name}] ready`);
    }

    /**
     * Receives a message from the bus and dispatches TASK messages to the agent loop.
     * Publishes a RESULT on success or an ERROR on failure back to the orchestrator.
     * @param message - The incoming message from the message bus.
     */
    private async handleMessage(message: AgentMessage): Promise<void> {
        if (message.type !== TASK_TYPE) return;

        logger.info(`[${this.name}] started`);
        logger.verbose(`[${this.name}] taskId: ${message.taskId} | payload: ${JSON.stringify(message.payload)}`);

        try {
            const result = await this.runAgentLoop(message);
            messageBus.publish(ORCHESTRATOR_NAME, {
                taskId: message.taskId,
                fromAgent: this.name,
                toAgent: ORCHESTRATOR_NAME,
                type: RESULT_TYPE,
                payload: result,
                timestamp: Date.now(),
            });
        } catch (err) {
            messageBus.publish(ORCHESTRATOR_NAME, {
                taskId: message.taskId,
                fromAgent: this.name,
                toAgent: ORCHESTRATOR_NAME,
                type: ERROR_TYPE,
                payload: err instanceof Error ? err.message : String(err),
                timestamp: Date.now(),
            });
        }
    };

    /**
     * Runs the model in a loop, executing tool calls until the model signals it is done.
     * @param message - The TASK message containing the payload to process.
     * @returns The final text response from the model.
     */
    private async runAgentLoop(message: AgentMessage): Promise<string> {
        const messages : OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: SYSTEM_NAME, content: this.systemPrompt },
            { role: USER_NAME, content: `Task: ${JSON.stringify(message.payload)}` },
        ];

        // OpenAI function calling requires tools to be registered in the client call, but we only want to include the tools that the agent actually has access to.
        const openAiTools : OpenAI.Chat.ChatCompletionTool[] = this.tools.map(tool =>({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            }
        }));

        while (true) {
            const response = await client.chat.completions.create({
                model: MODEL_NAME,
                messages: messages,
                ...(openAiTools.length > 0 && { tools: openAiTools }),
            });

            const choice = response.choices[0];
            if (!choice) throw new Error("No choices returned from model");

            // OpenAI model needs the full conversation history including tool results to continue reasoning.
            messages.push({
                role: ASSISTANT_NAME,
                content: choice.message.content,
                ...(choice.message.tool_calls && { tool_calls: choice.message.tool_calls }),
            });

            // If the model finished with a stop reason, return the content as final result.
            if (choice.finish_reason === "stop") {
                logger.info(`[${this.name}] done`);
                logger.verbose(`[${this.name}] total tokens: ${response.usage?.total_tokens}`);
                return choice.message.content ?? "";
            }

            // If the model wants to call a tool, execute it and add the result to the conversation history for the next iteration.
            if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
                for (const toolCall of choice.message.tool_calls) {
                    if (toolCall.type !== "function") continue;

                    const tool = this.tools.find(t => t.name === toolCall.function.name);
                    if (!tool) throw new Error(`Unknown Tool ${toolCall.function.name} not found`);

                    const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

                    logger.verbose(`[${this.name}] calling tool: ${toolCall.function.name}`);
                    const toolResult = await tool.run(args);

                    messages.push({
                        role: TOOL_NAME,
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult)
                    });
                }
            }
        }
    };


};
