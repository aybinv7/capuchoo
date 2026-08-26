import { hostname } from "node:os";
import { askSecret, askText, isInteractive, selectOne } from "../../cli/prompts.js";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { CloudClient } from "../../services/cloud.js";
import { TimeoutError } from "../../utils/http.js";
import { readGlobalConfig, updateGlobalConfig } from "../../utils/config.js";
import { BaseCommand } from "../../base-command.js";

const DEFAULT_ENDPOINT = "https://capuchoo-back.onrender.com";

export default class AuthLogin extends BaseCommand {
  static override description = "Sign in to a Capuchoo backend";

  static override examples = [
    "<%= config.bin %> auth login",
    "<%= config.bin %> auth login --endpoint https://capucho.internal --api-key cap_...",
  ];

  static override flags = {
    "api-key": Flags.string({
      char: "k",
      description: "API key from Settings > API Keys in the dashboard",
    }),
    endpoint: Flags.string({ char: "e", description: "Backend base URL" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogin);
    await AuthLogin.performLogin(flags.endpoint, flags["api-key"]);
  }

  /**
   * Shared with `capuchoo init`, which offers to log in when it finds no
   * credentials.
   *
   * Throws on failure rather than calling `this.error`, so the caller decides
   * whether a failed login ends the process or just ends the login step.
   */
  static async performLogin(flagEndpoint?: string, flagApiKey?: string): Promise<void> {
    const existing = readGlobalConfig();

    const endpoint = (
      flagEndpoint ??
      (await askText("Backend URL", {
        initial: existing.endpoint ?? DEFAULT_ENDPOINT,
        flag: "--endpoint",
        validate: (value) =>
          /^https?:\/\/.+/.test(value.trim()) ? undefined : "Must start with http:// or https://",
      }))
    )
      .trim()
      .replace(/\/+$/, "");

    const apiKey = (flagApiKey ?? (await AuthLogin.obtainKey(endpoint))).trim();

    const spinner = ora({ text: "Verifying", stream: process.stderr }).start();
    const profile = await new CloudClient(endpoint, apiKey).whoami();

    if (!profile) {
      spinner.fail("Those credentials were rejected");
      throw new Error(`${endpoint} did not accept that API key. Check the key and the URL.`);
    }

    spinner.succeed(`Signed in as ${profile.user.email}`);

    // Only what is needed to authenticate, plus who it belongs to. The old
    // implementation also wrote the full app and organization lists, which went
    // stale immediately - and `auth whoami` then read fields that `auth login`
    // never actually saved, so it always reported no organizations.
    updateGlobalConfig({
      endpoint,
      apiKey,
      user: { id: profile.user.id, email: profile.user.email },
      authenticatedAt: new Date().toISOString(),
    });
  }

  /**
   * Turns a sign-in failure into something actionable.
   *
   * There is deliberately no `capuchoo auth register`: confirming an email is a
   * browser round-trip, so a CLI signup could only ever end with "now go and
   * check your email". Accounts are created in the dashboard, and an unconfirmed
   * one is the state most likely to bring someone here confused.
   */
  static explainSignInFailure(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (/not confirmed/i.test(message)) {
      return (
        "That account exists but its email has not been confirmed yet. Open the " +
        "link in the sign-up email, then run this again."
      );
    }

    if (/invalid login credentials/i.test(message)) {
      return (
        "That email and password were not accepted. If you have not signed up yet, " +
        "create the account in the dashboard first - there is no signup here, " +
        "because confirming an email needs a browser."
      );
    }

    return message;
  }

  /**
   * Gets an API key, by signing in or by being handed one.
   *
   * Signing in is the default because pasting a key could not be the first step:
   * keys are made in the dashboard, and an app-scoped one cannot create apps -
   * so a new user had no way to reach a working state from the terminal at all.
   *
   * The token from `/auth/login` is used once, to mint a key, and then dropped.
   * A JWT expires; a key does not, so you sign in once per machine.
   */
  private static async obtainKey(endpoint: string): Promise<string> {
    if (!isInteractive()) {
      throw new Error(
        "Not a terminal, so there is nobody to ask. Pass --api-key, or set " +
          "CAPUCHOO_ENDPOINT and CAPUCHOO_API_KEY.",
      );
    }

    const method = await selectOne<"password" | "key">(
      "How would you like to sign in?",
      [
        { value: "password", label: "Email and password", hint: "creates a key for this machine" },
        { value: "key", label: "Paste an API key", hint: "from the dashboard" },
      ],
      "--api-key",
    );

    if (method === "key") {
      process.stderr.write(
        chalk.dim(`\n  Create a key under Settings > API Keys at ${endpoint}\n\n`),
      );
      // Length only. Requiring a "cap_" prefix is a server-side format decision
      // the CLI has no business enforcing.
      return askSecret("API key");
    }

    const email = await askText("Email", { flag: "--api-key" });
    // Never a flag: a password in argv is a password in shell history and CI logs.
    const password = await askSecret("Password");

    const spinner = ora({ text: "Signing in", stream: process.stderr }).start();

    let session;
    try {
      session = await CloudClient.login(endpoint, email.trim(), password);
    } catch (error) {
      // A sign-in is usually the first request of a session, so it meets the
      // backend at its coldest - and a host that sleeps when idle can take
      // longer than the default timeout to answer. The second attempt lands on
      // a service that is now awake.
      if (!(error instanceof TimeoutError)) {
        spinner.fail("Sign-in failed");
        throw new Error(AuthLogin.explainSignInFailure(error));
      }

      spinner.text = "The backend was asleep - waking it and retrying";
      try {
        session = await CloudClient.login(endpoint, email.trim(), password, 120_000);
      } catch (retried) {
        spinner.fail("Sign-in failed");
        throw new Error(AuthLogin.explainSignInFailure(retried));
      }
    }

    spinner.text = "Creating a key for this machine";

    try {
      const { key } = await new CloudClient(endpoint, session.token).createApiKey({
        name: `capuchoo-cli ${hostname()}`,
      });
      spinner.succeed("Created a key for this machine");
      return key;
    } catch (error) {
      spinner.fail("Signed in, but could not create an API key");
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }
}
