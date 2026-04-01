import { Router } from "express";
import { getSessions, getSession, getTraceEvents, getEvalReport } from "../lib/session-store";

const router = Router();

router.get("/sessions", (req, res) => {
  let sessions = getSessions();
  const { status, backend, limit } = req.query as Record<string, string | undefined>;
  if (status) sessions = sessions.filter(s => s.status === status);
  if (backend) sessions = sessions.filter(s => s.backend === backend);
  const lim = parseInt(limit ?? "50", 10);
  sessions = sessions.slice(0, isNaN(lim) ? 50 : lim);
  res.json(sessions);
});

router.get("/sessions/:sessionId", (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.get("/sessions/:sessionId/trace", (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  let events = getTraceEvents(req.params.sessionId);
  const { type } = req.query as { type?: string };
  if (type) events = events.filter(e => e.type === type);
  res.json(events);
});

router.get("/sessions/:sessionId/eval", (req, res) => {
  const report = getEvalReport(req.params.sessionId);
  if (!report) {
    res.status(404).json({ error: "Eval report not found for this session" });
    return;
  }
  res.json(report);
});

export default router;
