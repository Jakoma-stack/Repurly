import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Repurly',
  description: 'Daily LinkedIn Opportunity Desk for consultants, founders and expert-led businesses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <link rel="stylesheet" href="/app.css?v=manual-css-2" />
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}