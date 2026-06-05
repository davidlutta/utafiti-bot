import { BaseAgent } from "../base-agent";
import { SYNTHESISER_PROMPT } from "../prompts/synthesizer.prompt";
import { SYNTHESIZER_NAME } from "../Constants";

/**
 * Receives the collected results from all research agents and produces a single,
 * coherent final answer to the user's original query.
 * Registered on the message bus under {@link SYNTHESIZER_NAME}.
 * Takes no tools — its only job is to reason over the provided text and summarise.
 */
export class SynthesizerAgent extends BaseAgent {
    /** Registers the agent on the message bus and signals readiness. */
    constructor() {
        super(
            SYNTHESIZER_NAME,
            SYNTHESISER_PROMPT,
            []
        );
    }
}

new SynthesizerAgent();