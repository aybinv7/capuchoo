# MCP

The server speaks the [Model Context Protocol](https://modelcontextprotocol.io) at `/api/mcp`, so an
AI agent (Claude Code, Claude Desktop, Cursor, any MCP client) can work with Capuchoo directly: read
apps, channels, releases, builds, devices, recorded sessions and errors, follow a crash from its
replay to the source line that threw, and move channels after a person confirms.

The dashboard proxies `/api`, so the endpoint is `https://<dashboard>/api/mcp`, or
`https://<server>/api/mcp` directly. The dashboard's **API keys** page shows the exact setup for
each client.

## Connecting

Every call carries an API key as `Authorization: Bearer cap_...` (or `x-api-key`). Dashboard
sessions are refused: a browser cookie never reaches the endpoint.

Claude (claude.ai and the desktop app): Settings, Connectors, **Add custom connector**. Paste the
endpoint, choose **No sign-in** (not "Sign in now", which Claude preselects because the `401`
carries a Bearer challenge, but there is no OAuth yet), and add the request header
`Authorization: Bearer cap_...`.

Claude Code:

```sh
claude mcp add --transport http capuchoo https://<dashboard>/api/mcp --header "Authorization: Bearer cap_..."
```

Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "capuchoo": {
      "url": "https://<dashboard>/api/mcp",
      "headers": { "Authorization": "Bearer cap_..." }
    }
  }
}
```

A client without custom headers goes through `mcp-remote` until OAuth lands:

```json
{
  "mcpServers": {
    "capuchoo": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<dashboard>/api/mcp",
        "--header",
        "Authorization:${CAPUCHOO_AUTH}"
      ],
      "env": { "CAPUCHOO_AUTH": "Bearer cap_..." }
    }
  }
}
```

**Pick the key for the job.** The key's app restriction and role cap apply to every tool, exactly as
in the dashboard. A key capped at `viewer` gives an agent that can only read; limit it to one app if
it only needs one. A `developer` key can also deliver, roll back, pause and change what devices
record. Production moves still need the app's production role.

## Tools

| Tool                                  | What it answers                                                                                                                                               | Role                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `list_apps`                           | The apps the key reaches, with its role on each                                                                                                               | —                                  |
| `app_overview`                        | Delivery and session health, each channel's release, and what needs attention first                                                                           | viewer                             |
| `channel_details`                     | What a channel serves, its rollout (version mix, devices behind) and history                                                                                  | viewer                             |
| `list_releases`                       | Web bundles and native builds, with the channels serving each                                                                                                 | viewer                             |
| `list_builds`, `build_details`        | CLI and CI runs; for a failed job, the end of the failing step's log                                                                                          | viewer                             |
| `find_devices`, `device_details`      | Devices by search and filters; one device with its updates and sessions                                                                                       | viewer                             |
| `list_sessions`                       | Recorded sessions by device, version, errors, what started them                                                                                               | viewer                             |
| `session_timeline`                    | One session as a timeline: taps, typing, routes, requests, database writes, errors with stacks mapped to source (`logged_at` for an error logged without one) | viewer                             |
| `list_errors`, `error_details`        | Grouped errors; one with its sessions and source-mapped stack, or `logged_at`: the app code that logged it                                                    | viewer                             |
| `app_stats`                           | Daily update and session numbers, error rate by version                                                                                                       | viewer                             |
| `audit_log`                           | Who changed what                                                                                                                                              | admin                              |
| `set_error_status`                    | Resolve or reopen an error                                                                                                                                    | developer                          |
| `set_recording_rule`                  | What the app, a channel or a device records                                                                                                                   | developer                          |
| `go_live`                             | Stream one device for a few minutes                                                                                                                           | developer                          |
| `deliver_release`, `rollback_channel` | Point a channel at a release                                                                                                                                  | developer, prod role on production |
| `pause_channel`, `resume_channel`     | Stop or restart a channel serving updates                                                                                                                     | developer, prod role on production |

Three prompts start common jobs: `investigate_error`, `release_health` and `device_story`.

## Moves need a person

Every tool that changes what devices run answers twice:

1. Called without `confirmation`, it changes nothing and returns a **preview**: the channel, its
   environment, what it serves now and what it would serve, how many devices it reaches, and a
   **confirmation token**. If the server would refuse the move (wrong flavour, native gate, a client
   channel taking what its base never served, a downgrade without rollback), it says so instead,
   with the same reason the dashboard gives.
2. Called again with the **same arguments** and the token, it moves the channel. A production
   channel also needs `confirm_channel_name` typed out, as the dashboard asks.

The token is an HMAC of the caller, the key, the tool and its exact arguments, valid for 5 minutes:
it cannot be reused for another change, another channel or another person. Replaying it repeats a
move that already happened, which is a no-op. The tools are annotated `destructiveHint`, so clients
also ask before calling them. The server's instructions tell the model to show the preview and wait
for agreement.

Every write is in the audit log with its key and `via: "mcp"`.

## What stays private

- Query values in request URLs are hidden (`?token=…`), request and response bodies are never
  returned, and authorization headers were redacted on the phone before they were recorded.
- Typed values in masked fields stay `•••`; database writes are summarised by table and operation,
  without values.
- Storage keys, hashes and signing material never appear in an answer.

## Limits

- Stateless Streamable HTTP with JSON responses: each request gets a fresh server, nothing is kept
  between calls, so it scales and deploys like any other route.
- 120 requests in a burst, then 4 a second, per key; over that, `429` with `Retry-After`.
- Request bodies up to 256 KiB.
- A session timeline decompresses at most 48 MiB, skips the screen events unparsed and returns at
  most 500 items; source maps are cached per app, version and file (12 at a time).
- Any origin may call with a key: hosted agents call from their own origin, and since cookies are
  never accepted a page cannot borrow a dashboard session. Every refused request is logged
  (`mcp request refused`, with method, origin, user agent and whether a credential came, never the
  credential), so a client that cannot connect can be diagnosed from the server logs.

Measured locally against the demo organization, end to end through the SDK client: `tools/list` 13
ms, `app_overview` 51 ms, `error_details` 27 ms, and `session_timeline` 14 ms, which returns about
1.8 KB for a session that ends in an error.

## Next

OAuth 2.1 (authorization server metadata, dynamic client registration, PKCE), so claude.ai web
connectors can sign in without a key. The `401` already carries `WWW-Authenticate: Bearer`.
