import type {
  SentryIssuePayload,
  SentryErrorPayload,
  SentryAlertPayload,
  SentryHookResource,
  SentryWebhookPayload,
} from "./sentry-types.js";

/**
 * Format a Sentry webhook payload into a human-readable error description
 * suitable for passing as context to a Claude agent.
 */
export function formatSentryError(
  resource: SentryHookResource,
  payload: SentryWebhookPayload
): string {
  switch (resource) {
    case "issue":
      return formatIssue(payload as SentryIssuePayload);
    case "error":
      return formatError(payload as SentryErrorPayload);
    case "event_alert":
      return formatAlert(payload as SentryAlertPayload);
    default:
      return `Sentry ${resource} event (action: ${payload.action}):\n${JSON.stringify(payload.data, null, 2)}`;
  }
}

function formatIssue(payload: SentryIssuePayload): string {
  const issue = payload.data.issue;
  const lines = [
    `## Sentry Issue: ${issue.title}`,
    "",
    `- **Level**: ${issue.level}`,
    `- **Project**: ${issue.project.name} (${issue.project.slug})`,
    `- **Culprit**: ${issue.culprit}`,
    `- **Status**: ${issue.status} (${issue.substatus})`,
    `- **Occurrences**: ${issue.count}`,
    `- **Users affected**: ${issue.userCount}`,
    `- **First seen**: ${issue.firstSeen}`,
    `- **Last seen**: ${issue.lastSeen}`,
    `- **Platform**: ${issue.platform}`,
    `- **Link**: ${issue.permalink}`,
  ];

  if (issue.metadata.type) {
    lines.push(`- **Exception type**: ${issue.metadata.type}`);
  }
  if (issue.metadata.value) {
    lines.push(`- **Exception message**: ${issue.metadata.value}`);
  }
  if (issue.metadata.filename) {
    lines.push(`- **File**: ${issue.metadata.filename}`);
  }

  return lines.join("\n");
}

function formatError(payload: SentryErrorPayload): string {
  const error = payload.data.error;
  const lines = [
    `## Sentry Error: ${error.title}`,
    "",
    `- **Event ID**: ${error.event_id}`,
    `- **Level**: ${error.level}`,
    `- **Platform**: ${error.platform}`,
    `- **Project**: ${error.project}`,
    `- **Timestamp**: ${new Date(error.timestamp * 1000).toISOString()}`,
    `- **Link**: ${error.web_url}`,
  ];

  if (error.exception?.values?.length) {
    lines.push("", "### Exception Details");
    for (const exc of error.exception.values) {
      lines.push(``, `**${exc.type}**: ${exc.value}`);
      if (exc.stacktrace?.frames?.length) {
        lines.push("", "**Stacktrace** (most recent call last):");
        lines.push("```");
        // Sentry frames are bottom-up; reverse for readability
        const frames = [...exc.stacktrace.frames].reverse();
        for (const frame of frames) {
          const appMarker = frame.in_app ? " [app]" : "";
          lines.push(
            `  ${frame.filename}:${frame.lineno}:${frame.colno} in ${frame.function}${appMarker}`
          );
          if (frame.context_line) {
            lines.push(`    > ${frame.context_line.trim()}`);
          }
        }
        lines.push("```");
      }
    }
  }

  if (error.request) {
    lines.push(
      "",
      "### HTTP Request",
      `- **${error.request.method}** ${error.request.url}`
    );
    if (error.request.query_string) {
      lines.push(`- **Query**: ${error.request.query_string}`);
    }
  }

  if (error.tags?.length) {
    lines.push("", "### Tags");
    for (const tag of error.tags) {
      lines.push(`- ${tag.key}: ${tag.value}`);
    }
  }

  return lines.join("\n");
}

function formatAlert(payload: SentryAlertPayload): string {
  const lines = [
    `## Sentry Alert Triggered`,
    "",
    `- **Rule**: ${payload.data.triggered_rule}`,
    `- **Event data**: ${JSON.stringify(payload.data.event, null, 2).slice(0, 2000)}`,
  ];
  return lines.join("\n");
}
