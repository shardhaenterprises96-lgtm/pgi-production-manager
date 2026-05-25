import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import entitiesRouter from "./entities";
import invoicesRouter from "./invoices";
import paymentsRouter from "./payments";
import rewardsRouter from "./rewards";
import manufacturingRouter from "./manufacturing";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(entitiesRouter);
router.use(invoicesRouter);
router.use(paymentsRouter);
router.use(rewardsRouter);
router.use(manufacturingRouter);
router.use(dashboardRouter);

export default router;
