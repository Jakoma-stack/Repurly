import { WelcomeEmail } from "@/emails/welcome-email";
import { getResendClient } from "@/lib/email/client";

export async function sendWelcomeEmail(input: { to: string; name: string; workspaceName: string }) {
  const client = getResendClient();
  if (!client) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  return client.emails.send({
    from: process.env.EMAIL_FROM ?? "Repurly <hello@repurly.io>",
    to: input.to,
    subject: `Welcome to ${input.workspaceName}`,
    react: WelcomeEmail(input),
  });
}
