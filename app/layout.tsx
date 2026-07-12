import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Curvia — Image to Editable SVG',
  description:
    'Upload a raster image and get back a clean, structured, editable SVG — posterize, trace, and semantic repair in one pipeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
