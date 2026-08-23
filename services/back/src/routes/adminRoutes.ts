import { Router } from "express";
import { adminController, nativeUpdateController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";
import { authenticate, checkResourceAccess } from "@/middleware";

const router: Router = Router();

router.use(rateLimiter);
router.use(authenticate);

// ============================================================
// Bundle Management
// ============================================================

router.post(
  "/admin/upload",
  adminController.getUploadMiddleware(),
  adminController.uploadBundle.bind(adminController),
);

router.post(
  "/admin/native-upload",
  nativeUpdateController.getUploadMiddleware(),
  nativeUpdateController.uploadNativeUpdate.bind(nativeUpdateController),
);

router.get("/dashboard/bundles", adminController.getBundles.bind(adminController));

router.post("/dashboard/bundles", adminController.createBundle.bind(adminController));

router.put(
  "/dashboard/bundles/:id",
  checkResourceAccess("app_versions"),
  adminController.updateBundle.bind(adminController),
);

router.delete(
  "/dashboard/bundles/:id",
  checkResourceAccess("app_versions"),
  adminController.deleteBundle.bind(adminController),
);

router.post(
  "/dashboard/bundles/:id/promote",
  checkResourceAccess("app_versions"),
  adminController.promoteBundle.bind(adminController),
);

// ============================================================
// Apps Management (NEW - for multi-app support)
// ============================================================

// ============================================================
// Channel Management
// ============================================================

router.get("/dashboard/channels", adminController.getChannels.bind(adminController));

router.get(
  "/dashboard/channels/:id",
  checkResourceAccess("channels"),
  adminController.getChannel.bind(adminController),
);

router.post("/dashboard/channels", adminController.createChannel.bind(adminController));

router.put(
  "/dashboard/channels/:id",
  checkResourceAccess("channels"),
  adminController.updateChannel.bind(adminController),
);

router.delete(
  "/dashboard/channels/:id",
  checkResourceAccess("channels"),
  adminController.deleteChannel.bind(adminController),
);

// ============================================================
// Device Management
// ============================================================

router.get("/dashboard/devices", adminController.getDevices.bind(adminController));

router.put(
  "/dashboard/devices/:id/channel",
  adminController.updateDeviceChannel.bind(adminController),
);

router.delete("/dashboard/devices/:id", adminController.deleteDevice.bind(adminController));

// ============================================================
// Statistics & Logs
// ============================================================

router.get("/dashboard/stats", adminController.getDashboardStats.bind(adminController));

router.get("/dashboard/stats-data", adminController.getStatsData.bind(adminController));

router.get("/dashboard/update-logs", adminController.getUpdateLogs.bind(adminController));

// Native Update Dashboard
router.get(
  "/dashboard/native-updates",
  nativeUpdateController.getNativeUpdates.bind(nativeUpdateController),
);

router.put(
  "/dashboard/native-updates/:id",
  nativeUpdateController.updateNativeUpdate.bind(nativeUpdateController),
);

router.delete(
  "/dashboard/native-updates/:id",
  nativeUpdateController.deleteNativeUpdate.bind(nativeUpdateController),
);

export default router;
