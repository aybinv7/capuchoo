import { createReactiveQuery, createVueQueryMetrics } from "@cavulsqa/reactive-vue";
import { usePageVisibility } from "@cavulsqa/reactive-vue/framework7";
import { changeBus } from "./database";
import type { Database } from "./schema";

const metrics = createVueQueryMetrics({
  exposeOnWindowAs: import.meta.env.DEV ? "__appMetrics" : undefined,
});

/**
 * The composables every screen uses. They are built once, here, because the change bus and the
 * metrics recorder are app-wide singletons - a query created with a different bus would never hear
 * about a write.
 *
 * Typed on `Database`, so every `tables` entry is checked against the schema. A misspelt table name
 * is otherwise invisible: the query subscribes to a table nobody writes to and never refetches.
 */
export const { useReactiveQuery, useStructuralQuery, useStaticQuery } =
  createReactiveQuery<Database>({
    onTableChange: changeBus.on,
    metrics: metrics.recorder,
    // Without this a tab the user cannot see keeps refetching in the background.
    useVisibility: usePageVisibility,
  });

export const { useQueryMetrics } = metrics;
