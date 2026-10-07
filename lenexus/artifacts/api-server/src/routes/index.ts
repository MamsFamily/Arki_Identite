import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tribesRouter from "./tribes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tribesRouter);

export default router;
