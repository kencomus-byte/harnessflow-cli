import { SESSIONS as SEED, TRACE_EVENTS as SEED_TRACES, EVAL_REPORTS as SEED_EVALS, HARNESS_CONFIG as SEED_CONFIG } from "../data/harness-seed";
import type { Session, TraceEvent, EvalReport, HarnessConfig } from "../data/harness-types";

const sessions: Session[] = [...SEED];
const traceEvents: Record<string, TraceEvent[]> = { ...SEED_TRACES };
const evalReports: Record<string, EvalReport> = { ...SEED_EVALS };
let harnessConfig: HarnessConfig = { ...SEED_CONFIG };

export function getSessions(): Session[] {
  return [...sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getSession(id: string): Session | undefined {
  return sessions.find(s => s.sessionId === id);
}

export function addSession(s: Session): void {
  sessions.unshift(s);
}

export function updateSession(id: string, updates: Partial<Session>): void {
  const idx = sessions.findIndex(s => s.sessionId === id);
  if (idx !== -1) Object.assign(sessions[idx], updates);
}

export function removeSession(id: string): void {
  const idx = sessions.findIndex(s => s.sessionId === id);
  if (idx !== -1) sessions.splice(idx, 1);
}

export function getTraceEvents(sessionId: string): TraceEvent[] {
  return traceEvents[sessionId] ?? [];
}

export function appendTraceEvent(sessionId: string, event: TraceEvent): void {
  if (!traceEvents[sessionId]) traceEvents[sessionId] = [];
  traceEvents[sessionId].push(event);
}

export function setTraceEvents(sessionId: string, events: TraceEvent[]): void {
  traceEvents[sessionId] = events;
}

export function getEvalReport(sessionId: string): EvalReport | undefined {
  return evalReports[sessionId];
}

export function getConfig(): HarnessConfig {
  return harnessConfig;
}

export function setConfig(c: HarnessConfig): void {
  harnessConfig = { ...c };
}
