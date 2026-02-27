import { ReactNode } from "react";
import { Metadata } from "next";
import "./globals.css";
import { Toaster } from "../components/ui/sonner";
import { BRAND } from "../lib/brand";

interface RootLayoutProps {
  children: ReactNode;
}

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
