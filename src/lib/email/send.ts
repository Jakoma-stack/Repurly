import { WelcomeEmail } from "@/emails/welcome-email";
import { getResendClient } from "@/lib/email/client";

export async function sendWelcomeEmail(input: { to: string; name: string; workspaceName: string }) {
  return getResendClient().emails.send({
    from: process.env.EMAIL_FROM ?? "Repurly <hello@repurly.io>",
    to: input.to,
    subject: `Welcome to ${input.workspaceName}`,
    react: WelcomeEmail(input),
  });
}
