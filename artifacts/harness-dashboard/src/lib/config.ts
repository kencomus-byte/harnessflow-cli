// API base URL — Replit proxy routes /api/* to the API server
export const BASE_URL = "/";

export const API = {
  sessionsStart: "/api/sessions/start",
  sessionStop: (id: string) => `/api/sessions/${id}/stop`,
  terminalExec: "/api/terminal/exec",
  terminalEvents: (execId: string) => `/api/terminal/events/${execId}`,
  sessionExecId: (id: string) => `/api/sessions/${id}/exec-id`,
  config: "/api/config",
};
