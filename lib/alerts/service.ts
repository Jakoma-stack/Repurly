import { Resend } from 'resend';

export type OpsAlertSeverity = 'info' | 'warning' | 'critical';

export type OpsAlert = {
  source: string;
  title: string;
  severity: OpsAlertSeverity;
  message: string;
  metadata?: Record<string, unknown>;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

export async function sendOpsAlert(alert: OpsAlert) {
  const payload = {
    ...alert,
    sentAt: new Date().toISOString(),
  };

  if (process.env.ALERT_WEBHOOK_URL) {
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Best-effort alerting only in scaffold mode.
    }
  }

  const client = getResendClient();
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.EMAIL_FROM;

  if (client && to && from) {
    try {
      await client.emails.send({
        to,
        from,
        subject: `[Repurly] ${alert.severity.toUpperCase()} · ${alert.title}`,
        text: `${alert.message}\n\n${JSON.stringify(alert.metadata ?? {}, null, 2)}`,
      });
    } catch {
      // Do not block publishing for email delivery failures.
    }
  }
}
