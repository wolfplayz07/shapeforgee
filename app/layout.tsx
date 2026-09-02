import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShapeForge — Interactive Assembly Designer",
  description:
    "Generate, inspect, edit, validate, and progressively explode interactive mechanical concept assemblies.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
