import { Router } from "express";
import {
  buildAnalyticsSummary,
  buildTokenTimeline,
  TOOL_STATS,
  buildActivityFeed,
} from "../data/harness-seed";

const router = Router();

router.get("/analytics/summary", (_req, res) => {
  res.json(buildAnalyticsSummary());
});

router.get("/analytics/tokens", (req, res) => {
  const days = parseInt((req.query as Record<string, string>).days ?? "30", 10);
  res.json(buildTokenTimeline(isNaN(days) || days < 1 ? 30 : Math.min(days, 90)));
});

router.get("/analytics/tools", (_req, res) => {
  res.json(TOOL_STATS);
});

router.get("/analytics/activity", (req, res) => {
  const limit = parseInt((req.query as Record<string, string>).limit ?? "20", 10);
  res.json(buildActivityFeed(isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100)));
});

export default router;
