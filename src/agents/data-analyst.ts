import { BaseAgent } from "../base-agent";
import { DATA_ANALYST_PROMPT } from "../prompts/data-analyst.prompt";
import { DATA_ANALYST_NAME } from "../Constants";

/**
 * Specialised agent responsible for interpreting and analysing structured or
 * quantitative data as part of a multi-agent research job.
 * Registered on the message bus under {@link DATA_ANALYST_NAME}.
 * Takes no tools — analysis is performed through model reasoning alone.
 */
export class DataAnalystAgent extends BaseAgent {
    /** Registers the agent on the message bus and signals readiness. */
    constructor() {
        super(
            DATA_ANALYST_NAME,
            DATA_ANALYST_PROMPT,
            []
        );
    }
}

new DataAnalystAgent();