import { describe, expect, it } from "vite-plus/test";
import { newEnvFile, patchEnvFile } from "../pipeline/wiring.js";
import { planUnlink, stripUpdateLink } from "./unlink-plan.js";

const APP_ENV = [
  "VITE_APP_ID=com.company.app",
  "VITE_ENVIRONMENT=prod",
  "VITE_UPDATE_OTA_INSTALL=background",
  "",
].join("\n");

describe("stripUpdateLink", () => {
  it("undoes exactly what init's env step adds", () => {
    const patched = patchEnvFile(APP_ENV, "http://localhost:3000", "prod").content!;
    const result = stripUpdateLink(patched);
    expect(result.removed).toEqual(["VITE_UPDATE_API_URL", "VITE_UPDATE_CHANNEL"]);
    expect(result.content).toBe(APP_ENV);
  });

  it("keeps the app's own update tuning and everything else", () => {
    const result = stripUpdateLink(newEnvFile("dev", "com.company.app", "https://updates.example"));
    expect(result.content).toContain("VITE_APP_ID=com.company.app");
    expect(result.content).not.toContain("VITE_UPDATE_API_URL");
    expect(result.content).not.toContain("# Capuchoo. Both are required");
    expect(stripUpdateLink(APP_ENV)).toEqual({ content: null, removed: [] });
  });

  it("leaves a comment alone when it is not the one init wrote above the link", () => {
    const content = "# my note\nVITE_UPDATE_API_URL=x\nOTHER=1\n";
    expect(stripUpdateLink(content).content).toBe("# my note\nOTHER=1\n");
  });
});

describe("planUnlink", () => {
  const facts = {
    linked: true,
    appLabel: "Presalio (com.company.app)",
    envFilesWithLink: ["build/prod/.env.prod"],
    hasSigningKey: true,
    signedIn: true,
  };

  it("unlinks locally by default and keeps the key and the session", () => {
    expect(
      planUnlink(facts, { deleteApp: false, signOut: false, forgetSigningKey: false }).map(
        (action) => action.id,
      ),
    ).toEqual(["env", "project"]);
  });

  it("deletes the server app first, and marks what cannot be undone", () => {
    const plan = planUnlink(facts, { deleteApp: true, signOut: true, forgetSigningKey: true });
    expect(plan.map((action) => action.id)).toEqual([
      "delete-app",
      "env",
      "project",
      "signing-key",
      "sign-out",
    ]);
    expect(plan.filter((action) => action.destructive).map((action) => action.id)).toEqual([
      "delete-app",
      "signing-key",
    ]);
  });

  it("has nothing to do on a directory that was never linked", () => {
    expect(
      planUnlink(
        {
          linked: false,
          appLabel: null,
          envFilesWithLink: [],
          hasSigningKey: false,
          signedIn: false,
        },
        { deleteApp: true, signOut: true, forgetSigningKey: true },
      ),
    ).toEqual([]);
  });
});
