// Sentry webhook payload types based on the Internal Integration webhook API.
// Reference: https://docs.sentry.io/organization/integrations/integration-platform/webhooks/

export interface SentryWebhookPayload {
  action: string;
  installation: { uuid: string };
  data: Record<string, unknown>;
  actor: { type: string; id: number; name: string };
}

export interface SentryIssuePayload extends SentryWebhookPayload {
  action: "created" | "resolved" | "assigned" | "archived" | "unresolved";
  data: {
    issue: SentryIssue;
  };
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  status: "resolved" | "unresolved" | "ignored";
  substatus: string;
  platform: string;
  project: { id: string; name: string; slug: string };
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
  };
}

export interface SentryErrorPayload extends SentryWebhookPayload {
  action: "created";
  data: {
    error: SentryError;
  };
}

export interface SentryError {
  event_id: string;
  title: string;
  level: string;
  platform: string;
  project: string;
  url: string;
  web_url: string;
  issue_url: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          abs_path: string;
          function: string;
          lineno: number;
          colno: number;
          context_line?: string;
          pre_context?: string[];
          post_context?: string[];
          in_app: boolean;
        }>;
      };
    }>;
  };
  tags: Array<{ key: string; value: string }>;
  contexts: Record<string, Record<string, unknown>>;
  request?: {
    url: string;
    method: string;
    headers: Array<[string, string]>;
    query_string: string;
  };
  user?: {
    id?: string;
    email?: string;
    ip_address?: string;
  };
  timestamp: number;
}

export interface SentryAlertPayload extends SentryWebhookPayload {
  action: "triggered";
  data: {
    event: Record<string, unknown>;
    triggered_rule: string;
    issue_alert?: {
      settings: Array<{ name: string; value: string }>;
    };
  };
}

export type SentryHookResource =
  | "installation"
  | "event_alert"
  | "issue"
  | "metric_alert"
  | "error"
  | "comment";
