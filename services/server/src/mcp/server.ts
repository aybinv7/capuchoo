import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context";
import { registerAppTools } from "./tools/apps";
import { registerChannelTools } from "./tools/channels";
import { registerDeliveryTools } from "./tools/delivery";
import { registerDeviceTools } from "./tools/devices";
import { registerErrorTools } from "./tools/errors";
import { registerInsightTools } from "./tools/insights";
import { registerRecordingTools } from "./tools/recording";
import { registerReleaseTools } from "./tools/releases";
import { registerSessionTools } from "./tools/sessions";

export const MCP_SERVER_NAME = "capuchoo";
export const MCP_SERVER_VERSION = "1.0.0";

const INSTRUCTIONS = `Capuchoo ships over-the-air and native updates to Capacitor apps through channels, and records sessions on devices (screen, console, network, database) for replay.

How to work with it:
- Start with list_apps, then app_overview: it says what needs attention first.
- To debug a crash: list_errors or error_details, then session_timeline on one of its sessions; the timeline shows what the user did before the error and the stack mapped to source.
- To check a release: app_overview and channel_details (rollout, devices behind), app_stats for trends, list_sessions with a version to compare error rates.
- To help one user: device_details, list_sessions for that device, session_timeline; go_live streams the device while it is used.
- deliver_release, rollback_channel, pause_channel and resume_channel change what devices run. They answer first with a preview and a confirmation token: always show the preview to the user and only confirm with their explicit agreement. Production channels also need the channel's name typed out.
- Ids can be given as Capuchoo ids; an app can also be its bundle identifier, a channel its name, a device the id it reports.`;

function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "investigate_error",
    {
      title: "Investigate an error",
      description:
        "Find out why an error happens: who it hits, what leads to it, and where in the code.",
      argsSchema: {
        app: z.string().describe("The app id or bundle identifier."),
        error: z.string().optional().describe("An error id; the worst one is picked otherwise."),
      },
    },
    ({ app, error }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Investigate ${error ? `error ${error}` : "the error hurting users most"} in app ${app} on Capuchoo. ${error ? "" : "Use app_overview and list_errors to choose it. "}Read error_details, then session_timeline on two or three of its sessions on different devices or versions. Tell me what the users were doing, the exact cause in the source, which versions and how many devices are affected, and a fix. Do not change anything.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "release_health",
    {
      title: "Check a release",
      description: "How a release is rolling out and whether it breaks more than the one before.",
      argsSchema: {
        app: z.string().describe("The app id or bundle identifier."),
        channel: z.string().optional().describe("A channel to focus on."),
      },
    },
    ({ app, channel }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Check the health of the current release of app ${app} on Capuchoo${channel ? `, on channel ${channel}` : ""}. Use app_overview, channel_details and app_stats: rollout progress, install failures, and whether sessions on the new version hit errors more often than on the previous one. Finish with a clear recommendation: continue, hold, pause or roll back, and why. Do not change anything.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "device_story",
    {
      title: "What happened on a device",
      description:
        "A support summary of one device: its updates, its sessions and what went wrong.",
      argsSchema: {
        app: z.string().describe("The app id or bundle identifier."),
        device: z.string().describe("The device id, or the id it reports."),
      },
    },
    ({ app, device }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `A user of app ${app} has a problem on device ${device}. Use device_details, list_sessions for that device and session_timeline on the relevant sessions to tell me, in plain words a support agent can repeat, what they did, what went wrong and when, and what to tell them. Do not change anything.`,
          },
        },
      ],
    }),
  );
}

/** One server per request: the transport is stateless, so nothing outlives the call. */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION, title: "Capuchoo" },
    { instructions: INSTRUCTIONS, capabilities: { tools: {}, prompts: {} } },
  );
  registerAppTools(server, ctx);
  registerChannelTools(server, ctx);
  registerReleaseTools(server, ctx);
  registerDeviceTools(server, ctx);
  registerSessionTools(server, ctx);
  registerErrorTools(server, ctx);
  registerInsightTools(server, ctx);
  registerRecordingTools(server, ctx);
  registerDeliveryTools(server, ctx);
  registerPrompts(server);
  return server;
}
