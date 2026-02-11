export interface Config {
  sentryClientSecret: string;
  anthropicApiKey: string;
  projectCwd: string;
  port: number;
  agentMaxTurns: number;
  agentMaxBudgetUsd: number;
  agentModel: string;
  maxConcurrentAgents: number;
}

export function loadConfig(): Config {
  const required = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  };

  return {
    sentryClientSecret: required("SENTRY_CLIENT_SECRET"),
    anthropicApiKey: required("ANTHROPIC_API_KEY"),
    projectCwd: required("PROJECT_CWD"),
    port: parseInt(process.env.PORT || "3000", 10),
    agentMaxTurns: parseInt(process.env.AGENT_MAX_TURNS || "30", 10),
    agentMaxBudgetUsd: parseFloat(process.env.AGENT_MAX_BUDGET_USD || "2.00"),
    agentModel: process.env.AGENT_MODEL || "sonnet",
    maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || "3", 10),
  };
}
