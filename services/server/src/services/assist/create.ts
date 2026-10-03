import type { Db } from "../../db/database";
import type { BackgroundTasks } from "../../lib/background";
import { writeAudit } from "../../repositories/audit";
import type { EventHub } from "../event-hub";
import { AssistRegistry } from "./registry";

/**
 * The registry wired to this server: an invite wakes the device's held policy request through the
 * hub, and every decision lands in the audit log without holding up the socket.
 */
export function createAssistRegistry(parts: {
  db: Db;
  hub: EventHub;
  tasks: BackgroundTasks;
  now: () => Date;
}): AssistRegistry {
  return new AssistRegistry({
    now: () => parts.now().getTime(),
    invite: (appId, deviceId) =>
      parts.hub.publish({ type: "assist", appId, data: { device_id: deviceId } }),
    audit: ({ session, action, details }) =>
      parts.tasks.run("assist audit", () =>
        writeAudit(parts.db, {
          organizationId: session.organizationId,
          appId: session.appId,
          actorUserId: session.agent.userId,
          actorApiKeyId: session.agent.apiKeyId,
          action,
          targetType: "device",
          targetId: session.deviceUuid,
          details: { session: session.id, ...details },
        }),
      ),
  });
}
