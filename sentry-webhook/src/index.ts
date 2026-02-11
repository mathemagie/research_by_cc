import express from "express";
import { loadConfig } from "./config.js";
import { verifySentrySignature } from "./verify.js";
import { formatSentryError } from "./format-error.js";
import { AgentPool, spawnAgent } from "./agent-spawner.js";
import type { SentryHookResource, SentryWebhookPayload } from "./sentry-types.js";

const config = loadConfig();
const pool = new AgentPool(config.maxConcurrentAgents);
const app = express();

// Sentry sends JSON payloads. We need the raw body for signature verification
// and the parsed body for processing.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      // Attach raw body for HMAC verification
      (req as unknown as Record<string, Buffer>).rawBody = buf;
    },
  })
);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    activeAgents: pool.activeCount,
    hasCapacity: pool.hasCapacity,
  });
});

// Sentry webhook endpoint
app.post("/webhook/sentry", (req, res) => {
  const signature = req.headers["sentry-hook-signature"] as string | undefined;
  const resource = req.headers["sentry-hook-resource"] as SentryHookResource | undefined;
  const rawBody = (req as unknown as Record<string, Buffer>).rawBody;

  // --- Validate signature ---
  if (!signature || !rawBody) {
    console.warn("[webhook] Missing signature or body");
    res.status(401).json({ error: "Missing signature" });
    return;
  }

  if (!verifySentrySignature(rawBody.toString("utf8"), signature, config.sentryClientSecret)) {
    console.warn("[webhook] Invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // --- Parse payload ---
  const payload = req.body as SentryWebhookPayload;
  console.log(
    `[webhook] Received ${resource}:${payload.action} from installation ${payload.installation?.uuid}`
  );

  // --- Filter: only act on actionable error events ---
  if (!shouldSpawnAgent(resource, payload)) {
    console.log(`[webhook] Skipping ${resource}:${payload.action} — not actionable`);
    res.status(200).json({ status: "skipped" });
    return;
  }

  // --- Check concurrency ---
  if (!pool.hasCapacity) {
    console.warn(
      `[webhook] Agent pool full (${pool.activeCount}/${config.maxConcurrentAgents}), rejecting`
    );
    res.status(429).json({ error: "Agent pool at capacity" });
    return;
  }

  // --- Acknowledge the webhook immediately (Sentry requires <1s response) ---
  res.status(202).json({ status: "accepted", activeAgents: pool.activeCount + 1 });

  // --- Spawn agent asynchronously ---
  const errorDescription = formatSentryError(resource!, payload);
  handleAgentSpawn(errorDescription);
});

async function handleAgentSpawn(errorDescription: string): Promise<void> {
  if (!pool.acquire()) {
    console.warn("[spawn] Could not acquire agent slot");
    return;
  }

  console.log(`[spawn] Spawning agent (active: ${pool.activeCount})`);

  try {
    const result = await spawnAgent(errorDescription, config);

    console.log("[spawn] Agent completed:", {
      success: result.success,
      sessionId: result.sessionId,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      resultPreview: result.result.slice(0, 300),
    });

    // You can extend this to post results back to Sentry, Slack, etc.
    // Example: await postToSlack(result);
  } catch (err) {
    console.error("[spawn] Unhandled error:", err);
  } finally {
    pool.release();
    console.log(`[spawn] Agent slot released (active: ${pool.activeCount})`);
  }
}

function shouldSpawnAgent(
  resource: SentryHookResource | undefined,
  payload: SentryWebhookPayload
): boolean {
  if (!resource) return false;

  // Spawn on new issues (first occurrence of a new error pattern)
  if (resource === "issue" && payload.action === "created") return true;

  // Spawn on individual error events (requires Business/Enterprise plan)
  if (resource === "error" && payload.action === "created") return true;

  // Spawn on alert triggers (configured alert rules)
  if (resource === "event_alert" && payload.action === "triggered") return true;

  return false;
}

app.listen(config.port, () => {
  console.log(`[server] Sentry webhook agent spawner listening on port ${config.port}`);
  console.log(`[server] Project CWD: ${config.projectCwd}`);
  console.log(`[server] Max concurrent agents: ${config.maxConcurrentAgents}`);
  console.log(`[server] Agent model: ${config.agentModel}`);
  console.log(`[server] Agent budget: $${config.agentMaxBudgetUsd}/session`);
});
