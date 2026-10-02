import type { Db } from "../db/database";
import { DELIVERY, DELIVERY_FLEET, deliveryRuns } from "./delivery";
import { Dice } from "./dice";
import type { DemoContext } from "./context";
import { FIELD_SALES, FIELD_SALES_FLEET, fieldSalesRuns } from "./field-sales";
import { seedFleet, type DeviceKind, type FleetGroup } from "./fleet";
import { DEMO_NAME, createDemoOrganization, resetDemo } from "./organization";
import { seedCatalog, type AppCatalog } from "./releases";
import { seedRun, type RunSpec } from "./runs";

export { DEMO_NAME, DEMO_SLUG } from "./organization";

export interface DemoSummary {
  organization_id: string;
  organization: string;
  apps: Array<{ id: string; name: string; devices: number; events: number; runs: number }>;
}

interface DemoApp {
  catalog: AppCatalog;
  fleet: FleetGroup[];
  devices: DeviceKind;
  runs: () => RunSpec[];
}

const APPS: DemoApp[] = [
  { catalog: FIELD_SALES, fleet: FIELD_SALES_FLEET, devices: "tablet", runs: fieldSalesRuns },
  { catalog: DELIVERY, fleet: DELIVERY_FLEET, devices: "phone", runs: deliveryRuns },
];

/**
 * Replaces the fictional Northwind Distribution organization with a fresh one, owned by the
 * caller: two apps, client channels at different paces, a rollback, a pause, CI runs on GitHub
 * and GitLab with their jobs and logs, and four weeks of device activity. One transaction, so a
 * failure leaves the previous demo as it was.
 */
export function seedDemo(db: Db, input: { ownerId: string; now?: Date }): Promise<DemoSummary> {
  const now = input.now ?? new Date();
  return db.transaction().execute(async (trx) => {
    const dice = new Dice(20_261_002);
    await resetDemo(trx);
    const { organizationId, people } = await createDemoOrganization(trx, input.ownerId, now, dice);
    const context: DemoContext = { trx, now, dice, organizationId, people };
    const apps: DemoSummary["apps"] = [];
    for (const app of APPS) {
      const seeded = await seedCatalog(context, app.catalog);
      const fleet = await seedFleet(context, seeded, app.fleet, app.devices);
      const runs = app.runs();
      for (const run of runs) await seedRun(context, seeded, run);
      apps.push({
        id: seeded.id,
        name: app.catalog.name,
        devices: fleet.devices,
        events: fleet.events,
        runs: runs.length,
      });
    }
    return { organization_id: organizationId, organization: DEMO_NAME, apps };
  });
}
