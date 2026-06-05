import { BaseAgent } from "../base-agent";
import { WEB_SEARCH_NAME } from "../Constants";
import { WEB_SEARCH_PROMPT } from "../prompts/search-web.prompt";
import { searchTool } from "../tools/search-tool";

/**
 * Agent responsible for retrieving information from the web as part of a
 * multi-agent research job.
 * Registered on the message bus under {@link WEB_SEARCH_NAME}.
 * Equipped with {@link searchTool} to perform live web searches during its reasoning loop.
 */
export class WebSearchAgent extends BaseAgent {
    /** Registers the agent on the message bus and signals readiness. */
    constructor() {
        super(
            WEB_SEARCH_NAME,
            WEB_SEARCH_PROMPT,
            [searchTool]
        );
    }
}

new WebSearchAgent();