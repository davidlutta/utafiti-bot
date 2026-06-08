type LogLevel = "quiet" | "default" | "verbose";

function resolveLevel(): LogLevel {
    if (process.argv.includes("--verbose")) return "verbose";
    if (process.argv.includes("--quiet")) return "quiet";
    return "default";
}

const level = resolveLevel();

export const logger = {
    /** Raw bus traffic, payloads, token counts — verbose only. */
    verbose(msg: string): void {
        if (level === "verbose") console.log(msg);
    },
    /** Key lifecycle events (agent started, tool called, job done) — default and verbose. */
    info(msg: string): void {
        if (level !== "quiet") console.log(msg);
    },
    /** Final user-facing output — always shown regardless of flag. */
    output(msg: string): void {
        console.log(msg);
    },
};
