import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "repurly-v2",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
