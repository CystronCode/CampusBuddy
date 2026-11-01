import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CampusOS · Your campus, connected",
  description:
    "Your classes, campus knowledge and opportunities in one secure workspace.",
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
