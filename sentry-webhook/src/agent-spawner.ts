import type { Config } from "./config.js";

// The Claude Agent SDK is imported dynamically so the module can still
// load in environments where the SDK is not installed (e.g., for tests).
// The SDK exports `query()` as the primary entry point.

export interface AgentResult {
  sessionId?: string;
  success: boolean;
  result: string;
  costUsd?: number;
  durationMs?: number;
}

/**
 * Tracks running agents and enforces the concurrency limit.
 */
export class AgentPool {
  private running = 0;

  constructor(private readonly maxConcurrent: number) {}

  get activeCount(): number {
    return this.running;
  }

  get hasCapacity(): boolean {
    return this.running < this.maxConcurrent;
  }

  acquire(): boolean {
    if (!this.hasCapacity) return false;
    this.running++;
    return true;
  }

  release(): void {
    this.running = Math.max(0, this.running - 1);
  }
}

/**
 * Spawn a Claude agent to investigate a Sentry error.
 *
 * The agent is given read-only tools by default (Read, Grep, Glob) for
 * investigation. Set `allowWrite` to true to also grant Edit and Bash.
 */
export async function spawnAgent(
  errorDescription: string,
  config: Config,
  opts: { allowWrite?: boolean } = {}
): Promise<AgentResult> {
  // Dynamic import — the SDK uses ESM
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const tools = ["Read", "Grep", "Glob", "Task"];
  if (opts.allowWrite) {
    tools.push("Edit", "Write", "Bash");
  }

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    5 * 60 * 1000 // 5-minute hard timeout
  );

  const prompt = buildPrompt(errorDescription, opts.allowWrite ?? false);

  try {
    let sessionId: string | undefined;
    let lastResult = "";
    let costUsd: number | undefined;
    let durationMs: number | undefined;

    for await (const message of query({
      prompt,
      options: {
        allowedTools: tools,
        permissionMode: "acceptEdits",
        cwd: config.projectCwd,
        maxTurns: config.agentMaxTurns,
        maxBudgetUsd: config.agentMaxBudgetUsd,
        model: config.agentModel,
        abortController,
        systemPrompt: {
          type: "preset" as const,
          preset: "claude_code" as const,
          append: AGENT_SYSTEM_APPEND,
        },
      },
    })) {
      // Extract session ID from any message that carries it
      if ("session_id" in message && typeof message.session_id === "string") {
        sessionId = message.session_id;
      }

      // Capture the final result
      if (message.type === "result") {
        const result = message as Record<string, unknown>;
        lastResult =
          typeof result.result === "string" ? result.result : JSON.stringify(result);
        if (typeof result.total_cost_usd === "number") costUsd = result.total_cost_usd;
        if (typeof result.duration_ms === "number") durationMs = result.duration_ms;
      }

      // Log assistant text output for observability
      if (
        message.type === "assistant" &&
        message.message?.content
      ) {
        for (const block of message.message.content as Array<Record<string, unknown>>) {
          if ("text" in block && typeof block.text === "string") {
            console.log(`[agent] ${block.text.slice(0, 200)}`);
          }
        }
      }
    }

    return {
      sessionId,
      success: true,
      result: lastResult,
      costUsd,
      durationMs,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[agent-spawner] Agent failed: ${errorMsg}`);
    return { success: false, result: errorMsg };
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(errorDescription: string, canWrite: boolean): string {
  const action = canWrite
    ? "Investigate the following production error, identify the root cause, and implement a fix."
    : "Investigate the following production error and identify the root cause. Provide a detailed analysis with the exact files and lines that need to change, but do NOT modify any files.";

  return `${action}

${errorDescription}

Steps:
1. Analyze the error details (exception type, message, stacktrace)
2. Locate the relevant source files in the codebase
3. Read and understand the surrounding code context
4. Identify the root cause
${canWrite ? "5. Implement a fix\n6. Run tests if available to verify the fix" : "5. Describe what the fix should be, with exact code changes"}

Provide a clear summary of your findings at the end.`;
}

const AGENT_SYSTEM_APPEND = `You are a production debugging specialist. You have been automatically spawned by a Sentry webhook integration to investigate a runtime error.

Guidelines:
- Focus on finding the ROOT CAUSE, not just the symptom
- Trace the error through the call stack methodically
- Consider edge cases: null/undefined values, type mismatches, race conditions, missing error handling
- If the stacktrace points to a dependency, check how the project calls that dependency
- Provide actionable findings — specific files, line numbers, and what needs to change`;
