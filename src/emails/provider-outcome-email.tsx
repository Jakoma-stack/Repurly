import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';

export function ProviderOutcomeEmail({
  workspaceName,
  title,
  message,
  actionHref,
}: {
  workspaceName: string;
  title: string;
  message: string;
  actionHref: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'Inter, Arial, sans-serif' }}>
        <Container style={{ margin: '24px auto', background: '#ffffff', padding: '32px', borderRadius: '18px' }}>
          <Heading>{workspaceName} publish update</Heading>
          <Text>{title}</Text>
          <Text>{message}</Text>
          <Section>
            <Button href={actionHref} style={{ backgroundColor: '#6d5efc', color: '#ffffff', padding: '12px 18px', borderRadius: '10px' }}>
              Open in Repurly
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
