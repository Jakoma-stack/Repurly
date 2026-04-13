import { Resend } from "resend";

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return apiKey ? new Resend(apiKey) : null;
}
