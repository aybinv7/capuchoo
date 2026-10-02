import { mergeJob } from "@/shared/live/stream-reducer";
import type { BuildChild, BuildDetail, BuildJob } from "@/shared/types/build";

const sameJob = (a: BuildJob, b: BuildJob) =>
  a.status === b.status &&
  a.attempt === b.attempt &&
  a.updated_at === b.updated_at &&
  a.steps.length === b.steps.length &&
  a.finished_at === b.finished_at;

const sameChild = (a: BuildChild, b: BuildChild) =>
  a.status === b.status &&
  a.finished_at === b.finished_at &&
  a.error === b.error &&
  a.events.length === b.events.length;

/**
 * Folds a freshly read detail (a sync) into the cached one. Jobs never regress, and rows that did
 * not change keep their identity, so a sync that finds nothing new re-renders nothing.
 */
export function reconcileDetail(
  current: BuildDetail | undefined,
  incoming: BuildDetail,
): BuildDetail {
  if (!current) return incoming;
  const jobs = new Map(current.jobs.map((job) => [job.id, job]));
  const children = new Map(current.children.map((child) => [child.id, child]));
  return {
    ...incoming,
    jobs: incoming.jobs.map((job) => {
      const before = jobs.get(job.id);
      const kept = mergeJob(before, job);
      return before && (kept === before || sameJob(before, kept)) ? before : kept;
    }),
    children: incoming.children.map((child) => {
      const before = children.get(child.id);
      return before && sameChild(before, child) ? before : child;
    }),
    events: incoming.events.length >= current.events.length ? incoming.events : current.events,
  };
}
