import { Router, type IRouter } from "express";
import healthRouter from "./health";
import credentialsRouter from "./credentials";
import importsRouter from "./imports";
import templatesRouter from "./templates";
import settingsRouter from "./settings";
import ordersRouter from "./orders";
import storesRouter from "./stores";
import productsRouter from "./products";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(credentialsRouter);
router.use(importsRouter);
router.use(templatesRouter);
router.use(settingsRouter);
router.use(ordersRouter);
router.use(storesRouter);
router.use(productsRouter);

export default router;
