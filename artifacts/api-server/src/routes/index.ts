import { Router, type IRouter } from "express";
import healthRouter from "./health";
import harnessSessionsRouter from "./harness-sessions";
import harnessAnalyticsRouter from "./harness-analytics";
import harnessConfigRouter from "./harness-config";
import harnessRunRouter from "./harness-run";

const router: IRouter = Router();

router.use(healthRouter);
router.use(harnessRunRouter);
router.use(harnessSessionsRouter);
router.use(harnessAnalyticsRouter);
router.use(harnessConfigRouter);

export default router;
