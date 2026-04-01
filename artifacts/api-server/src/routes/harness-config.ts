import { Router } from "express";
import { HARNESS_CONFIG } from "../data/harness-seed";

const router = Router();

router.get("/config", (_req, res) => {
  res.json(HARNESS_CONFIG);
});

export default router;
