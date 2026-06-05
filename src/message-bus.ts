import { EventEmitter } from "events";
import { ERROR_TYPE, RESULT_TYPE, TASK_TYPE } from "./Constants";

export type MessageType = typeof TASK_TYPE | typeof RESULT_TYPE | typeof ERROR_TYPE;

export interface AgentMessage {
    taskId: string;
    fromAgent: string;
    toAgent: string;
    type: MessageType;
    payload: unknown;
    timestamp: number;
}

class MessageBus {
    private emitter: EventEmitter;

    constructor() {
        this.emitter = new EventEmitter();
    }

    /**
     * Emits a message to all handlers subscribed to the given channel.
     * @param channel - The target agent name to route the message to.
     * @param message - The message payload to deliver.
     */
    publish(channel: string, message: AgentMessage) {
        console.log(`[bus] FromAgent:${message.fromAgent} → ToAgent:${message.toAgent} | ${message.type} | task:${message.taskId}`);
        this.emitter.emit(channel, message);
    }

    /**
     * Registers a handler to receive messages on the given channel.
     * @param channel - The channel name to listen on (typically the agent's name).
     * @param handler - Callback invoked with each message published to the channel.
     */
    subscribe(channel: string, handler: (message: AgentMessage) => void) {
        this.emitter.on(channel, handler);
    }

    /**
     * Removes a previously registered handler from the given channel.
     * @param channel - The channel the handler was subscribed to.
     * @param handler - The exact handler reference to remove.
     */
    unsubscribe(channel: string, handler: (message: AgentMessage) => void) {
        this.emitter.off(channel, handler);
    }
}

export const messageBus = new MessageBus();