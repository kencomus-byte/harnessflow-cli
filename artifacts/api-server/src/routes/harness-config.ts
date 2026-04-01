import { Router } from "express";
import { getConfig, setConfig } from "../lib/session-store";

const router = Router();

router.get("/config", (_req, res) => {
  res.json(getConfig());
});

router.put("/config", (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    res.status(400).json({ error: "Body must be a JSON object" });
    return;
  }
  setConfig(incoming);
  res.json({ ok: true, config: getConfig() });
});

export default router;
