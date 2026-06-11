import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { v4 as uuidv4 } from "uuid";
import { DATABASE_FILE_NAME, MESSAGES_NAME, SESSIONS_NAME, UPDATED_AT_NAME } from "../Constants";
import { logger } from "../logger";

/** A single query/response exchange stored within a session. */
interface Message {
    id: string;
    /** The user's original query text. */
    query: string;
    /** The agent's generated report/response. */
    report: string;
    created_at: number;
}

/** A conversation session grouping one or more messages. */
interface Session {
    id: string;
    /** Set to the text of the first query in the session. */
    title: string;
    /** LLM-generated summary of the conversation; null until explicitly set. */
    summary: string | null;
    created_at: number;
    updated_at: number;
    messages: Message[]
}

/** Root shape of the lowdb JSON database. */
interface DatabaseSchema {
    sessions: Session[]
}


const adapter = new FileSync<DatabaseSchema>(DATABASE_FILE_NAME);
const db = low(adapter);

db.defaults({ sessions: [] }).write();


/**
 * Creates a new session, using `firstQuery` as its title, and persists it to disk.
 * @param firstQuery - The user's opening query; becomes the session title.
 * @returns The newly created Session object.
 */
export function createSession(firstQuery: string): Session {
    const session: Session = {
        id: uuidv4(),
        title: firstQuery,
        summary: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        messages: []
    };

    db.get(SESSIONS_NAME)
      .push(session)
      .write();

    logger.verbose(`[database] created session: ${session.id}`);
    logger.info(`[database] created new sesion`);
    return session;
}

/**
 * Appends a message to an existing session and updates its `updated_at` timestamp.
 * @param sessionId - ID of the session to append the message to.
 * @param query - The user's query text.
 * @param report - The agent's response/report text.
 */
export function saveMessage(sessionId:string, query:string, report:string): void {
    const message: Message = {
        id: uuidv4(),
        query,
        report,
        created_at: Date.now()
    };

    // find the matched session object
    db.get(SESSIONS_NAME)
      .find({ id: sessionId })
      .get(MESSAGES_NAME)
      .push(message)
      .write();

      // Updating "updated_at" field on a found document without touching the rest of the object.
      db.get(SESSIONS_NAME)
        .find({ id: sessionId })
        .assign({ updated_at: Date.now() })
        .write();

        logger.verbose(`[database] saved message to session: ${sessionId}`);
        logger.info(`[database] saved message to session`);
}

/**
 * Sets or replaces the summary on an existing session.
 * @param sessionId - ID of the session to update.
 * @param summary - The generated summary text.
 */
export function updateSummary(sessionId: string, summary: string): void {
    db.get(SESSIONS_NAME)
      .find({ id: sessionId })
      .assign({ summary, updated_at: Date.now() })
      .write();
    logger.verbose(`[database] updated summary for session: ${sessionId}`);
    logger.info(`[database] updated summary for session`);
}

/**
 * Returns the most recently updated session, or `undefined` if none exist.
 */
export function getLastSession(): Session | undefined {
    return db.get(SESSIONS_NAME)
             .sortBy(UPDATED_AT_NAME)
             .last()
             .value();
}

/**
 * Returns all sessions sorted by `updated_at` descending (most recent first).
 */
export function getAllSessions(): Session[] {
    return db.get(SESSIONS_NAME)
             .sortBy(UPDATED_AT_NAME)
             .reverse()
             . value();
}

/**
 * Looks up a session by its UUID.
 * @param id - The session UUID.
 * @returns The matching Session, or `undefined` if not found.
 */
export function getSessionById(id: string): Session | undefined {
    return db.get(SESSIONS_NAME)
             .find({ id })
             .value();
}

/**
 * Extracts the summary and message history from a session into a plain object
 * suitable for adding an LLM's conversation context.
 * @param session - The session to read from.
 * @returns An object containing the session summary and a stripped-down message list.
 */
export function loadSessionIntoMemory(session: Session): {
    summary: string | null;
    messages: { query: string; report: string }[]
}{
    return {
        summary: session.summary,
        messages: session.messages.map((msg) => ({
            query: msg.query,
            report: msg.report
        }))
    };
}