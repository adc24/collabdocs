import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";
import "./assessment.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "CollabDocs — A little space for big ideas",
  description:
    "Your thoughts, plans, and next big thing. A thoughtful, collaborative workspace for writing together.",
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider demoMode={process.env.DEMO_MODE !== "false"}>
          {children}
        </WorkspaceProvider>
      </body>
    </html>
  );
}
