import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import productsRouter from "./products";
import entitiesRouter from "./entities";
import invoicesRouter from "./invoices";
import purchasesRouter from "./purchases";
import paymentsRouter from "./payments";
import rewardsRouter from "./rewards";
import manufacturingRouter from "./manufacturing";
import dashboardRouter from "./dashboard";
import accountsRouter from "./accounts";
import workersRouter from "./workers";
import expensesRouter from "./expenses";
import customerOrdersRouter from "./customer-orders";
import reportsRouter from "./reports";
import subscriptionsRouter from "./subscriptions";
import settingsRouter from "./settings";
import gstinRouter from "./gstin";
import { requireAuth } from "../lib/tenant";

const router: IRouter = Router();

// Public routes (no session required).
router.use(healthRouter);
router.use(authRouter);

// Everything below requires an authenticated session. This is the single choke
// point that guarantees no data route can be reached anonymously, and exposes
// req.companyId / req.isSuperAdmin to downstream handlers.
router.use(requireAuth);

router.use(usersRouter);
router.use(productsRouter);
router.use(entitiesRouter);
router.use(invoicesRouter);
router.use(purchasesRouter);
router.use(paymentsRouter);
router.use(rewardsRouter);
router.use(manufacturingRouter);
router.use(dashboardRouter);
router.use(accountsRouter);
router.use(workersRouter);
router.use(expensesRouter);
router.use(customerOrdersRouter);
router.use(reportsRouter);
router.use(subscriptionsRouter);
router.use(settingsRouter);
router.use(gstinRouter);

export default router;
