import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const serif = Fraunces({ subsets: ['latin'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: "SalesFlow",
  description: "Multi-profile Upwork lead intelligence and proposal workflow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${geist.variable} ${serif.variable} bg-[#f5efe6] text-stone-950 antialiased`}>
        {children}
      </body>
    </html>
  );
}
