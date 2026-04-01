import { Router } from "express";
import {
  SESSIONS,
  TRACE_EVENTS,
  EVAL_REPORTS,
} from "../data/harness-seed";

const router = Router();

router.get("/sessions", (req, res) => {
  let sessions = [...SESSIONS];
  const { status, backend, limit } = req.query as Record<string, string | undefined>;
  if (status) sessions = sessions.filter(s => s.status === status);
  if (backend) sessions = sessions.filter(s => s.backend === backend);
  const lim = parseInt(limit ?? "50", 10);
  sessions = sessions.slice(0, isNaN(lim) ? 50 : lim);
  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  res.json(sessions);
});

router.get("/sessions/:sessionId", (req, res) => {
  const session = SESSIONS.find(s => s.sessionId === req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.get("/sessions/:sessionId/trace", (req, res) => {
  const session = SESSIONS.find(s => s.sessionId === req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  let events = TRACE_EVENTS[req.params.sessionId] ?? [];
  const { type } = req.query as { type?: string };
  if (type) events = events.filter(e => e.type === type);
  res.json(events);
});

router.get("/sessions/:sessionId/eval", (req, res) => {
  const report = EVAL_REPORTS[req.params.sessionId];
  if (!report) {
    res.status(404).json({ error: "Eval report not found for this session" });
    return;
  }
  res.json(report);
});

export default router;
