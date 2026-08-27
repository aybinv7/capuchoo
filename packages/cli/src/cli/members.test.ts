import { describe, expect, it } from "vite-plus/test";
import { emailOf, membershipRows, resolveByEmail } from "./members.js";
import type { Membership } from "../services/cloud.js";

const members: Membership[] = [
  { user_id: "u1", role: "owner", users: { id: "u1", email: "ayb@example.com" } },
  { user_id: "u2", role: "developer", users: { id: "u2", email: "Dev@Example.com" } },
  { user_id: "u3", role: "viewer", users: null },
];

describe("emailOf", () => {
  it("prefers the joined email", () => {
    expect(emailOf(members[0]!)).toBe("ayb@example.com");
  });

  // The join can come back empty; showing a blank row would be worse than a uuid.
  it("falls back to the user id", () => {
    expect(emailOf(members[2]!)).toBe("u3");
  });
});

describe("resolveByEmail", () => {
  it("finds a member", () => {
    expect(resolveByEmail(members, "ayb@example.com")).toEqual({ ok: true, userId: "u1" });
  });

  // Addresses are not case-sensitive in practice, and a failed match here means
  // someone cannot remove a colleague.
  it("ignores case and surrounding space", () => {
    expect(resolveByEmail(members, "  DEV@example.COM ")).toMatchObject({ ok: true, userId: "u2" });
  });

  it("lists who is present when there is no match", () => {
    const result = resolveByEmail(members, "nobody@example.com");

    expect(result.ok).toBe(false);
    expect(result.problem).toContain("ayb@example.com");
    expect(result.problem).toContain("nobody@example.com");
  });

  it("says so when there are no members at all", () => {
    expect(resolveByEmail([], "a@b.c").problem).toContain("none yet");
  });

  it("requires an email", () => {
    expect(resolveByEmail(members, "   ")).toMatchObject({ ok: false });
  });

  /**
   * Two rows with one address would make the choice arbitrary, and removing the
   * wrong person is not undoable from here.
   */
  it("refuses to guess between duplicates", () => {
    const duplicated = [
      ...members,
      { user_id: "u9", role: "viewer", users: { id: "u9", email: "ayb@example.com" } },
    ];

    expect(resolveByEmail(duplicated, "ayb@example.com")).toMatchObject({ ok: false });
    expect(resolveByEmail(duplicated, "ayb@example.com").problem).toContain("2 members");
  });
});

describe("membershipRows", () => {
  // Alphabetical ignoring case, which is what a reader expects - ASCII order
  // would put every capitalised address in a block of its own.
  it("sorts by email so a long list is scannable", () => {
    expect(membershipRows(members).map((row) => row.email)).toEqual([
      "ayb@example.com",
      "Dev@Example.com",
      "u3",
    ]);
  });

  it("carries the role through", () => {
    expect(membershipRows(members).find((row) => row.email === "u3")?.role).toBe("viewer");
  });
});
