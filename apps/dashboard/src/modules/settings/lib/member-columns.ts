import type { AnyColumnDef } from "@/shared/components/data-table";
import { actionsColumn } from "@/shared/components/data-table";
import type { Member } from "../types/settings.types";

const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 };

export const MEMBER_COLUMNS: AnyColumnDef<Member>[] = [
  {
    id: "member",
    accessorFn: (member) => member.users.full_name || member.users.email,
    size: 320,
    meta: { title: "Member" },
  },
  {
    id: "email",
    accessorFn: (member) => member.users.email,
    size: 260,
    meta: { title: "Email", defaultHidden: true },
  },
  {
    id: "role",
    accessorFn: (member) => member.role,
    sortingFn: (a, b) => (ROLE_RANK[a.original.role] ?? 9) - (ROLE_RANK[b.original.role] ?? 9),
    size: 160,
    meta: { title: "Role" },
  },
  actionsColumn<Member>(110),
];
