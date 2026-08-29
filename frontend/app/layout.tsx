import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PayFlow — Money Movement',
  description: 'Send, request and track money.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
