import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import * as React from "react";

export function WelcomeEmail({ name, workspaceName }: { name: string; workspaceName: string }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Repurly</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "Inter, Arial, sans-serif" }}>
        <Container style={{ margin: "24px auto", background: "#ffffff", padding: "32px", borderRadius: "18px" }}>
          <Heading>Welcome to Repurly</Heading>
          <Text>Hi {name},</Text>
          <Text>{workspaceName} is ready. Connect LinkedIn, upload your brand assets, and start building scheduled content workflows.</Text>
          <Section>
            <Button href="https://app.repurly.io/app" style={{ backgroundColor: "#6d5efc", color: "#ffffff", padding: "12px 18px", borderRadius: "10px" }}>
              Open workspace
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
