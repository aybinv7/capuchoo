import { Router } from "express";
import updateRoutes from "./updateRoutes";
import statsRoutes from "./statsRoutes";
import channelRoutes from "./channelRoutes";
import adminRoutes from "./adminRoutes";
import healthRoutes from "./healthRoutes";
import nativeUpdateRoutes from "./nativeUpdateRoutes";
import authRoutes from "./authRoutes";
import projectRoutes from "./projectRoutes";
import organizationRoutes from "./organizationRoutes";
import userRoutes from "./userRoutes";
import appRoutes from "./appRoutes";
import onboardingRoutes from "./onboardingRoutes";
import apiKeyRoutes from "./apiKeyRoutes";
import { healthController } from "@/controllers";

const router: Router = Router();

// Mount order is load-bearing. `adminRoutes` is mounted at "/" and applies
// `authenticate` at router level, so anything registered after it is reached
// only by an already-authenticated request. That made /api/auth/login and
// /api/auth/register answer 401 to everyone - they had never been callable, and
// nobody noticed because the dashboard authenticates against Supabase directly.
//
// Every prefixed router therefore comes first, and the "/" ones last.
router.use("/auth", authRoutes);
router.use("/api-keys", apiKeyRoutes);
router.use("/organizations", organizationRoutes);
router.use("/users", userRoutes);
router.use("/apps", appRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/project", projectRoutes);

router.use("/", updateRoutes);
router.use("/", statsRoutes);
router.use("/", channelRoutes);
router.use("/", healthRoutes);
router.use("/", nativeUpdateRoutes);
router.use("/", adminRoutes);

router.get("/health", healthController.basicHealthCheck.bind(healthController));

export default router;
