import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';

const brandPreview = process.env.JANEOMI_BRAND_PREVIEW === 'true';
export const metadata: Metadata = {
  title: brandPreview ? 'Janeomi · brand preview' : 'Repurly',
  description: 'Human-approved marketing strategy and LinkedIn opportunity intelligence.',
  ...(brandPreview ? { icons: { icon: '/brand/repurly/mark.svg' } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
