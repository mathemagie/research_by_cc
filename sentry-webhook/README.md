# Sentry Webhook → Claude Agent Spawner

A webhook server that receives Sentry error events and automatically spawns Claude Code agents (via the Claude Agent SDK) to investigate and diagnose production errors.

## How it works

```
Sentry Error → Webhook POST → Verify Signature → Format Error → Spawn Claude Agent
                                                                       ↓
                                                              Agent reads codebase,
                                                              traces the stacktrace,
                                                              identifies root cause
```

1. **Sentry Internal Integration** sends a webhook when a new issue/error occurs
2. **This server** verifies the HMAC-SHA256 signature, parses the payload, and formats it into a structured error description
3. **A Claude agent** is spawned via `@anthropic-ai/claude-agent-sdk` with the error context as its prompt
4. The agent reads your codebase, traces the stacktrace, and reports findings

## Setup

### 1. Install dependencies

```bash
cd sentry-webhook
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required variables:

| Variable | Description |
|---|---|
| `SENTRY_CLIENT_SECRET` | Client Secret from your Sentry Internal Integration |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `PROJECT_CWD` | Absolute path to the project codebase to investigate |

### 3. Create a Sentry Internal Integration

1. Go to **Sentry → Settings → Developer Settings → New Internal Integration**
2. Set **Webhook URL** to your server's URL (e.g., `https://your-server.com/webhook/sentry`)
3. Set permissions: **Issue & Event → Read**
4. Enable webhook subscriptions: **issue**, **error** (Business plan), **event_alert**
5. Save, then copy the **Client Secret**

### 4. Run the server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Expose locally (for testing)

```bash
npx ngrok http 3000
# Use the ngrok URL as your Sentry webhook URL
```

## Architecture

```
src/
├── index.ts          # Express server, webhook endpoint, request routing
├── config.ts         # Environment variable loading and validation
├── verify.ts         # HMAC-SHA256 signature verification
├── format-error.ts   # Sentry payload → human-readable error description
├── sentry-types.ts   # TypeScript types for Sentry webhook payloads
└── agent-spawner.ts  # Claude Agent SDK integration and concurrency pool
```

### Event handling

| Sentry Event | Action | Agent spawned? |
|---|---|---|
| `issue:created` | New error pattern detected | Yes |
| `error:created` | Individual error event (Business plan) | Yes |
| `event_alert:triggered` | Alert rule triggered | Yes |
| `issue:resolved` | Issue marked resolved | No |
| `issue:assigned` | Issue assigned to someone | No |

### Safety controls

- **Concurrency limit**: `MAX_CONCURRENT_AGENTS` (default: 3) prevents runaway costs
- **Budget cap**: `AGENT_MAX_BUDGET_USD` per session (default: $2.00)
- **Turn limit**: `AGENT_MAX_TURNS` (default: 30)
- **Hard timeout**: 5-minute abort controller
- **Read-only by default**: Agents only get `Read`, `Grep`, `Glob`, `Task` tools

## Extending

### Post results to Slack

In `src/index.ts`, after the agent completes in `handleAgentSpawn()`, add:

```typescript
await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: `*Sentry Error Investigated*\n${result.result.slice(0, 3000)}`,
  }),
});
```

### Enable write mode (auto-fix)

Pass `{ allowWrite: true }` to `spawnAgent()` in `handleAgentSpawn()`. This grants the agent `Edit`, `Write`, and `Bash` tools so it can implement fixes directly. Use with caution — recommended only in sandboxed environments.

### Add Sentry MCP server for richer context

The agent can query Sentry directly for more context by adding an MCP server in `agent-spawner.ts`:

```typescript
mcpServers: {
  sentry: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@sentry/mcp-server"],
    env: { SENTRY_AUTH_TOKEN: "..." }
  }
}
```
