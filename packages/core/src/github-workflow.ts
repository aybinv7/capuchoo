/**
 * The GitHub Actions workflow Capuchoo generates. It lives in core rather than the CLI because
 * two writers produce it - `capuchoo ci init --github` on disk, and the server when it opens the
 * setup pull request - and both must write the same file byte for byte.
 */

import { CI_BUILD_TYPES, GITHUB_WORKFLOW_INPUTS as INPUT } from "./ci-run.js";

export const GITHUB_WORKFLOW_PATH = ".github/workflows/capuchoo.yml";

/** Repository secrets the workflow reads, and the one variable. */
export const GITHUB_WORKFLOW_SECRETS = [
  "CAPUCHOO_API_KEY",
  "CAPUCHOO_SIGNING_KEY",
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
] as const;
export type GithubWorkflowSecret = (typeof GITHUB_WORKFLOW_SECRETS)[number];
export const GITHUB_WORKFLOW_VARIABLE = "CAPUCHOO_ENDPOINT";

export interface GithubWorkflowOptions {
  cliVersion: string;
  appDir?: string;
  defaultBranch?: string;
  devBranch?: string;
  stagingBranch?: string;
  clients?: readonly string[];
  nodeVersion?: string;
  androidPlatform?: string;
  androidBuildTools?: string;
}

const BRANCH = /^(?!.*\.\.)(?!\/)(?!.*\/$)[A-Za-z0-9._\/-]{1,100}$/;
const CLIENT = /^[a-z0-9][a-z0-9-]{0,56}$/;
const APP_DIR = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@\/-]{1,200}$/;
const VERSIONISH = /^[0-9A-Za-z.+-]{1,40}$/;

const q = (value: string): string => JSON.stringify(value);

function assert(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

/** The options with defaults applied; throws on anything that would be unsafe to write into YAML. */
export function resolveGithubWorkflowOptions(
  options: GithubWorkflowOptions,
): Required<GithubWorkflowOptions> {
  const resolved = {
    cliVersion: options.cliVersion,
    appDir: (options.appDir ?? ".").replace(/\\/g, "/").replace(/\/+$/, "") || ".",
    defaultBranch: options.defaultBranch ?? "main",
    devBranch: options.devBranch ?? "dev",
    stagingBranch: options.stagingBranch ?? "staging",
    clients: [
      ...new Set(
        (options.clients ?? []).map((client) =>
          client
            .trim()
            .toLowerCase()
            .replace(/^prod-/, ""),
        ),
      ),
    ].filter(Boolean),
    nodeVersion: options.nodeVersion ?? "22",
    androidPlatform: options.androidPlatform ?? "android-35",
    androidBuildTools: options.androidBuildTools ?? "35.0.0",
  };
  assert(VERSIONISH.test(resolved.cliVersion), "cliVersion is not a version");
  assert(APP_DIR.test(resolved.appDir), "appDir must be a relative path inside the repository");
  for (const branch of [resolved.defaultBranch, resolved.devBranch, resolved.stagingBranch]) {
    assert(BRANCH.test(branch), `"${branch}" is not a branch name`);
  }
  assert(
    new Set([resolved.defaultBranch, resolved.devBranch, resolved.stagingBranch]).size === 3,
    "The default, dev and staging branches must be three different branches",
  );
  for (const client of resolved.clients) {
    assert(CLIENT.test(client), `"${client}" is not a usable client name`);
  }
  assert(resolved.clients.length <= 50, "At most 50 clients");
  for (const value of [
    resolved.nodeVersion,
    resolved.androidPlatform,
    resolved.androidBuildTools,
  ]) {
    assert(VERSIONISH.test(value), `"${value}" is not a version`);
  }
  return resolved;
}

function indent(block: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

const CAPUCHOO_ENV = [
  "CAPUCHOO_ENDPOINT: ${{ vars.CAPUCHOO_ENDPOINT }}",
  "CAPUCHOO_API_KEY: ${{ secrets.CAPUCHOO_API_KEY }}",
  "CAPUCHOO_SIGNING_KEY: ${{ secrets.CAPUCHOO_SIGNING_KEY }}",
].join("\n");

function nodeSteps(nodeVersion: string): string {
  return `- uses: actions/checkout@v5
- uses: actions/setup-node@v5
  with:
    node-version: ${q(nodeVersion)}
- uses: actions/cache@v4
  with:
    path: ~/.cache/capuchoo-pm
    key: capuchoo-pm-\${{ runner.os }}-\${{ hashFiles('**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock', '**/bun.lock', '**/bun.lockb') }}
    restore-keys: capuchoo-pm-\${{ runner.os }}-
- name: Install
  shell: bash
  run: |
    set -euo pipefail
    STORE="$HOME/.cache/capuchoo-pm"
    PM_VERSION=$(node -p "const p = require('./package.json'); (p.packageManager || '').split('@')[1]?.split('+')[0] || p.devEngines?.packageManager?.version || 'latest'")
    if [ -f pnpm-lock.yaml ]; then
      npm install -g --silent "pnpm@$PM_VERSION"
      pnpm config set store-dir "$STORE/pnpm"
      pnpm install --frozen-lockfile
    elif [ -f yarn.lock ]; then
      corepack enable
      yarn install --immutable
    elif [ -f bun.lock ] || [ -f bun.lockb ]; then
      npm install -g --silent bun
      bun install --frozen-lockfile
    else
      npm ci --cache "$STORE/npm"
    fi
    echo "$GITHUB_WORKSPACE/node_modules/.bin" >> "$GITHUB_PATH"
    echo "$GITHUB_WORKSPACE/$APP_DIR/node_modules/.bin" >> "$GITHUB_PATH"`;
}

function planJob(o: Required<GithubWorkflowOptions>): string {
  const clients = o.clients.join(" ");
  return `plan:
  runs-on: ubuntu-latest
  timeout-minutes: 5
  outputs:
    action: \${{ steps.plan.outputs.action }}
    channel: \${{ steps.plan.outputs.channel }}
    version: \${{ steps.plan.outputs.version }}
    client: \${{ steps.plan.outputs.client }}
  steps:
    - id: plan
      shell: bash
      env:
        EVENT_NAME: \${{ github.event_name }}
        REF_TYPE: \${{ github.ref_type }}
        REF_NAME: \${{ github.ref_name }}
        BASE_REF: \${{ github.base_ref }}
        INPUT_ACTION: \${{ inputs.${INPUT.action} }}
        INPUT_CHANNEL: \${{ inputs.${INPUT.channel} }}
        INPUT_VERSION: \${{ inputs.${INPUT.version} }}
        INPUT_CLIENT: \${{ inputs.${INPUT.client} }}
        DEFAULT_BRANCH: ${q(o.defaultBranch)}
        DEV_BRANCH: ${q(o.devBranch)}
        STAGING_BRANCH: ${q(o.stagingBranch)}
        CLIENTS: ${q(clients)}
      run: |
        set -euo pipefail
        action="\${INPUT_ACTION:-}"
        channel="\${INPUT_CHANNEL:-}"
        version="\${INPUT_VERSION:-}"
        client="\${INPUT_CLIENT:-}"
        if [ "$client" = "none" ]; then client=""; fi
        tagged=false
        case "$EVENT_NAME" in
          pull_request)
            action="check"; target="$BASE_REF"; channel=""; version="auto" ;;
          push)
            target="$REF_NAME"
            if [ "$REF_TYPE" = "tag" ]; then tagged=true; action="ota"
            elif [ "$target" = "$DEFAULT_BRANCH" ]; then action="check"
            else action="ota"; fi ;;
          workflow_dispatch)
            target="$REF_NAME"
            if [ "$REF_TYPE" = "tag" ]; then tagged=true; fi
            if [ -z "$action" ]; then action="ota"; fi ;;
          *)
            echo "::error::Capuchoo does not run on $EVENT_NAME"; exit 1 ;;
        esac
        if [ -z "$channel" ]; then
          if [ "$tagged" = true ]; then channel="prod"
          elif [ "$target" = "$STAGING_BRANCH" ]; then channel="staging"
          elif [ "$target" = "$DEV_BRANCH" ]; then channel="dev"
          elif [ "$target" = "$DEFAULT_BRANCH" ]; then channel="prod"
          else echo "::error::$target is not a release branch; start the run with a channel."; exit 1; fi
        fi
        if [ -z "$version" ]; then
          if [ "$tagged" = true ]; then version="$REF_NAME"; else version="auto"; fi
        fi
        case "$action" in ota|native|check|deliver) ;; *) echo "::error::Unknown action $action"; exit 1 ;; esac
        if ! [[ "$channel" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then echo "::error::Bad channel $channel"; exit 1; fi
        if ! [[ "$version" =~ ^(auto|v?[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?)$ ]]; then echo "::error::Bad version $version"; exit 1; fi
        if [ "$action" != "check" ] && [ "$channel" = "prod" ] && [ "$version" = "auto" ]; then
          echo "::error::Prod is published from a tag or an exact version, never -v auto."; exit 1
        fi
        if [ "$action" = "deliver" ]; then
          if [ -z "$client" ] || ! [[ " $CLIENTS " == *" $client "* ]]; then
            echo "::error::deliver needs one of the clients this workflow was generated for: $CLIENTS"; exit 1
          fi
          if [ "$version" = "auto" ]; then echo "::error::deliver needs the exact version prod serves"; exit 1; fi
        fi
        {
          echo "action=$action"
          echo "channel=$channel"
          echo "version=$version"
          echo "client=$client"
        } >> "$GITHUB_OUTPUT"
        echo "**$action** to \\\`$channel\\\` at \\\`$version\\\`\${client:+ for $client}" >> "$GITHUB_STEP_SUMMARY"`;
}

function checkJob(o: Required<GithubWorkflowOptions>): string {
  return `check:
  needs: plan
  if: needs.plan.outputs.action != 'deliver' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)
  runs-on: ubuntu-latest
  timeout-minutes: 30
  steps:
${indent(nodeSteps(o.nodeVersion), 4)}
    - name: Rehearse the deploy
      shell: bash
      working-directory: \${{ env.APP_DIR }}
      env:
${indent(CAPUCHOO_ENV, 8)}
        CHANNEL: \${{ needs.plan.outputs.channel }}
        VERSION: \${{ needs.plan.outputs.version }}
      run: capuchoo deploy ota --channel "$CHANNEL" -v "$VERSION" --dry-run --yes --json > "$GITHUB_WORKSPACE/capuchoo-check.json"
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: capuchoo-check
        retention-days: 7
        if-no-files-found: ignore
        path: |
          capuchoo-check.json
          \${{ env.APP_DIR }}/capuchoo-deploy.log`;
}

function otaJob(o: Required<GithubWorkflowOptions>): string {
  return `publish-ota:
  needs: [plan, check]
  if: needs.plan.outputs.action == 'ota'
  runs-on: ubuntu-latest
  timeout-minutes: 30
  environment: \${{ needs.plan.outputs.channel }}
  concurrency:
    group: capuchoo-\${{ needs.plan.outputs.channel }}
    cancel-in-progress: false
  steps:
${indent(nodeSteps(o.nodeVersion), 4)}
    - name: Publish the OTA bundle
      shell: bash
      working-directory: \${{ env.APP_DIR }}
      env:
${indent(CAPUCHOO_ENV, 8)}
        CHANNEL: \${{ needs.plan.outputs.channel }}
        VERSION: \${{ needs.plan.outputs.version }}
        NOTE: \${{ inputs.${INPUT.notes} || github.event.head_commit.message || github.sha }}
      run: capuchoo deploy ota --channel "$CHANNEL" -v "$VERSION" --note "$NOTE" --yes --json > "$GITHUB_WORKSPACE/capuchoo-ota.json"
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: capuchoo-ota
        retention-days: 30
        if-no-files-found: ignore
        path: |
          capuchoo-ota.json
          \${{ env.APP_DIR }}/capuchoo-deploy.log`;
}

function nativeJob(o: Required<GithubWorkflowOptions>): string {
  return `publish-native:
  needs: [plan, check]
  if: needs.plan.outputs.action == 'native'
  runs-on: ubuntu-latest
  timeout-minutes: 60
  environment: \${{ needs.plan.outputs.channel }}
  concurrency:
    group: capuchoo-\${{ needs.plan.outputs.channel }}
    cancel-in-progress: false
  steps:
    - uses: actions/setup-java@v5
      with:
        distribution: temurin
        java-version: "21"
    - uses: android-actions/setup-android@v3
      with:
        packages: ${q(`platform-tools platforms;${o.androidPlatform} build-tools;${o.androidBuildTools}`)}
${indent(nodeSteps(o.nodeVersion), 4)}
    - name: Restore the release keystore
      if: inputs.${INPUT.buildType} != 'debug'
      shell: bash
      working-directory: \${{ env.APP_DIR }}
      env:
        KEYSTORE_BASE64: \${{ secrets.ANDROID_KEYSTORE_BASE64 }}
        KEYSTORE_PASSWORD: \${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
        KEY_ALIAS: \${{ secrets.ANDROID_KEY_ALIAS }}
        KEY_PASSWORD: \${{ secrets.ANDROID_KEY_PASSWORD }}
      run: |
        set -euo pipefail
        if [ -z "$KEYSTORE_BASE64" ]; then
          echo "::error::ANDROID_KEYSTORE_BASE64 is not set; a release APK cannot be signed."
          exit 1
        fi
        printf '%s' "$KEYSTORE_BASE64" | base64 -d > android/release.keystore
        printf 'RELEASE_STORE_FILE=%s\\nRELEASE_STORE_PASSWORD=%s\\nRELEASE_KEY_ALIAS=%s\\nRELEASE_KEY_PASSWORD=%s\\n' \\
          "$PWD/android/release.keystore" "$KEYSTORE_PASSWORD" "$KEY_ALIAS" "$KEY_PASSWORD" >> android/local.properties
        {
          echo "CAPUCHOO_KEYSTORE_FILE=release.keystore"
          echo "CAPUCHOO_KEYSTORE_PASSWORD=$KEYSTORE_PASSWORD"
          echo "CAPUCHOO_KEY_ALIAS=$KEY_ALIAS"
          echo "CAPUCHOO_KEY_PASSWORD=$KEY_PASSWORD"
        } >> "$GITHUB_ENV"
    - name: Build and publish the APK
      shell: bash
      working-directory: \${{ env.APP_DIR }}
      env:
${indent(CAPUCHOO_ENV, 8)}
        CHANNEL: \${{ needs.plan.outputs.channel }}
        VERSION: \${{ needs.plan.outputs.version }}
        BUILD_TYPE: \${{ inputs.${INPUT.buildType} || 'release' }}
        NOTE: \${{ inputs.${INPUT.notes} || github.event.head_commit.message || github.sha }}
      run: capuchoo deploy native --channel "$CHANNEL" --type="$BUILD_TYPE" -v "$VERSION" --note "$NOTE" --yes --json > "$GITHUB_WORKSPACE/capuchoo-native.json"
    - name: Remove the keystore
      if: always()
      shell: bash
      run: rm -f "$APP_DIR/android/release.keystore"
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: capuchoo-native
        retention-days: 30
        if-no-files-found: ignore
        path: |
          capuchoo-native.json
          \${{ env.APP_DIR }}/capuchoo-deploy.log`;
}

function deliverJob(o: Required<GithubWorkflowOptions>): string {
  return `deliver:
  needs: plan
  if: needs.plan.outputs.action == 'deliver'
  runs-on: ubuntu-latest
  timeout-minutes: 10
  environment: prod-\${{ needs.plan.outputs.client }}
  concurrency:
    group: capuchoo-prod-\${{ needs.plan.outputs.client }}
    cancel-in-progress: false
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v5
      with:
        node-version: ${q(o.nodeVersion)}
    - name: Point the client channel at what prod serves
      shell: bash
      working-directory: \${{ env.APP_DIR }}
      env:
${indent(CAPUCHOO_ENV, 8)}
        CLIENT: \${{ needs.plan.outputs.client }}
        VERSION: \${{ needs.plan.outputs.version }}
        RUN_URL: \${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}
      run: npx --yes "@capuchoo/cli@$CAPUCHOO_CLI_VERSION" channel point "prod-$CLIENT" --version "\${VERSION#v}" --reason "GitHub $RUN_URL" --yes --json`;
}

/** The workflow file, deterministic for the same options. */
export function renderGithubWorkflow(options: GithubWorkflowOptions): string {
  const o = resolveGithubWorkflowOptions(options);
  const actions = ["ota", "native", "check", ...(o.clients.length > 0 ? ["deliver"] : [])];
  const releaseBranches = [o.devBranch, o.stagingBranch, o.defaultBranch].map(q).join(", ");
  const jobs = [
    planJob(o),
    checkJob(o),
    otaJob(o),
    nativeJob(o),
    ...(o.clients.length > 0 ? [deliverJob(o)] : []),
  ];

  const clientInput =
    o.clients.length > 0
      ? `
      ${INPUT.client}:
        description: "deliver: the client whose prod-<client> channel is pointed"
        type: choice
        options: [${["none", ...o.clients].map(q).join(", ")}]
        default: "none"`
      : "";

  return `# Generated by Capuchoo ${o.cliVersion} (capuchoo ci init --github, or the dashboard's setup).
# Regenerate rather than edit: the dashboard reads the job graph from this file.
#
#   tag v*                 -> prod, at the tag's version
#   ${o.stagingBranch.padEnd(22)} -> staging, -v auto
#   ${o.devBranch.padEnd(22)} -> dev, -v auto
#   ${o.defaultBranch.padEnd(22)} -> rehearsal against prod, nothing uploaded
#   pull request           -> rehearsal against the target branch's channel
#   Run workflow           -> any action, started from GitHub or the Capuchoo dashboard
#
# A native APK is built only when a run asks for one, so a web-only change never waits for Gradle.
# Each publish job runs in a GitHub environment named after its channel: add required reviewers
# to prod (and to every prod-<client>) to make a person approve it.
#
# Variable  CAPUCHOO_ENDPOINT          backend base URL
# Secrets   CAPUCHOO_API_KEY           API key limited to this app
#           CAPUCHOO_SIGNING_KEY       base64 PKCS#8 body of .capuchoo/signing-key.pem (optional)
#           ANDROID_KEYSTORE_BASE64    the release keystore, base64 (native only)
#           ANDROID_KEYSTORE_PASSWORD  ANDROID_KEY_ALIAS  ANDROID_KEY_PASSWORD  (native only)

name: Capuchoo

on:
  push:
    branches: [${releaseBranches}]
    tags: ["v*"]
  pull_request:
    branches: [${releaseBranches}]
  workflow_dispatch:
    inputs:
      ${INPUT.action}:
        description: "ota publishes the web bundle, native builds an APK, check rehearses${o.clients.length > 0 ? ", deliver points a client channel" : ""}"
        type: choice
        options: [${actions.map(q).join(", ")}]
        default: "ota"
      ${INPUT.channel}:
        description: "Channel; empty derives it from the branch or tag"
        type: string
        default: ""
      ${INPUT.version}:
        description: "auto, an exact x.y.z, or empty for the ref's default"
        type: string
        default: ""${clientInput}
      ${INPUT.notes}:
        description: "Release notes shown in the update prompt"
        type: string
        default: ""
      ${INPUT.buildType}:
        description: "native only: release needs the signing secrets"
        type: choice
        options: [${CI_BUILD_TYPES.map(q).join(", ")}]
        default: "release"

permissions:
  contents: read

concurrency:
  group: capuchoo-\${{ github.ref }}-\${{ github.event_name }}-\${{ inputs.${INPUT.action} }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}

env:
  APP_DIR: ${q(o.appDir)}
  CAPUCHOO_CLI_VERSION: ${q(o.cliVersion)}

jobs:
${indent(jobs.join("\n\n"), 2)}
`;
}
