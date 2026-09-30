export type TerminalLineKind = "command" | "output" | "success" | "muted";

export interface TerminalLine {
  kind: TerminalLineKind;
  text: string;
}

export interface CliExample {
  id: string;
  label: string;
  summary: string;
  lines: readonly TerminalLine[];
}

/** Commands as the CLI accepts them; output lines paraphrase what it prints. */
export const CLI_EXAMPLES: readonly CliExample[] = [
  {
    id: "deploy",
    label: "Deploy",
    summary:
      "The channel picks the flavour: env file, native config, icons. The build is signed and uploaded, and no device sees it until a channel points at it.",
    lines: [
      { kind: "command", text: "capuchoo deploy ota --channel prod" },
      { kind: "output", text: "resolve   flavour prod · version 1.4.3" },
      { kind: "output", text: "web       vite build with the prod env" },
      { kind: "output", text: "sign      ECDSA P-256 · sha256 recorded" },
      { kind: "success", text: "1.4.3 uploaded · not served yet" },
    ],
  },
  {
    id: "point",
    label: "Deliver",
    summary: "Delivering is moving a pointer. Every move is checked, recorded and reversible.",
    lines: [
      { kind: "command", text: "capuchoo channel point prod --version 1.4.3" },
      { kind: "output", text: "prod      1.4.2 → 1.4.3 (forward)" },
      { kind: "success", text: "devices on prod update on their next check" },
    ],
  },
  {
    id: "client",
    label: "Client channel",
    summary:
      "Each customer follows prod at their own pace, and never receives a release prod has not served.",
    lines: [
      { kind: "command", text: "capuchoo channel create prod-acme --client --base prod" },
      { kind: "command", text: "capuchoo channel point prod-acme --version 1.4.3" },
      { kind: "output", text: "prod-acme  1.4.2 → 1.4.3" },
      { kind: "muted", text: "prod-nova stays on 1.4.2 until you point it" },
      { kind: "success", text: "only Acme's devices update" },
    ],
  },
  {
    id: "rollback",
    label: "Roll back",
    summary: "Going back is explicit, and the reason stays in the channel history.",
    lines: [
      {
        kind: "command",
        text: 'capuchoo channel point prod --version 1.4.2 --rollback --reason "login crash"',
      },
      { kind: "output", text: "prod      1.4.3 → 1.4.2 (downgrade allowed)" },
      { kind: "success", text: "devices return to 1.4.2 on their next check" },
    ],
  },
  {
    id: "ci",
    label: "GitLab CI",
    summary: "Generate a pipeline that builds once and reports each step to the dashboard.",
    lines: [
      { kind: "command", text: "capuchoo ci init --gitlab" },
      { kind: "output", text: "wrote     .gitlab-ci.yml" },
      { kind: "muted", text: "set CAPUCHOO_ENDPOINT and CAPUCHOO_API_KEY as CI variables" },
      { kind: "success", text: "each build shows up live on the canvas" },
    ],
  },
];
