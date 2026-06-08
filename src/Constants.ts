export const MODEL_NAME = "gpt-4o-mini";
export const MAX_HISTORY_TOKENS = 2000;

// Agent identity constants
export const ORCHESTRATOR_NAME = "orchestrator";
export const WORKER_NAME = "worker";
export const SYSTEM_NAME = "system";
export const USER_NAME = "user";
export const ASSISTANT_NAME = "assistant";
export const TOOL_NAME = "tool";
export const SYNTHESIZER_NAME = "synthesizer";
export const DATA_ANALYST_NAME = "data-analyst";
export const WEB_SEARCH_NAME = "web-search";

// Task status constants
export const PENDING_STATUS = "PENDING";
export const COMPLETED_STATUS = "COMPLETED";
export const FAILED_STATUS = "FAILED";

// Message types for the message bus
export const TASK_TYPE = "TASK";
export const RESULT_TYPE = "RESULT";
export const ERROR_TYPE = "ERROR";