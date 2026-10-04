import { computed, type Ref } from "vue";
import { useRecordingStats } from "../../queries/useRecordingStats";
import { RouteName } from "../../router/route-names";
import type { NavBadge } from "../navigation";

/** Counts the app menu shows beside its items: unresolved errors, red once one regressed. */
export function useNavBadges(appId: Ref<string>) {
  const { data } = useRecordingStats(appId, 14);
  return computed<Partial<Record<string, NavBadge>>>(() => {
    const issues = data.value?.issues;
    if (!issues) return {};
    const count = issues.open + issues.regressed;
    if (count === 0) return {};
    return {
      [RouteName.recordingIssues]: {
        count,
        urgent: issues.regressed > 0,
        label:
          issues.regressed > 0
            ? `${count} unresolved errors, ${issues.regressed} came back`
            : `${count} unresolved errors`,
      },
    };
  });
}
