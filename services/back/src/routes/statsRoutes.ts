import { Router } from "express";
import { statsController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";
import { normalizeRequestFields } from "@/middleware/fieldNormalizer";

const router: Router = Router();
router.use(rateLimiter);

// Apply field normalization to handle snake_case from OTA plugin
router.use(normalizeRequestFields);

/**
 * Stats endpoint the plugin calls
 * POST /stats - Send analytics and events
 *
 * Accepts both 'action' (official) and 'status' (legacy) fields
 */
router.post("/stats", statsController.logStats.bind(statsController));

export default router;
