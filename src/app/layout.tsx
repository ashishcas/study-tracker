import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://prompt-forge.in";

export const viewport: Viewport = {
  themeColor: "#ff6b35",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "StudiesTimer - Aesthetic Pomodoro Timer, Study Habits & Heatmap",
    template: "%s | StudiesTimer",
  },
  description:
    "Free aesthetic online Pomodoro timer, study habit tracker, and GitHub-style annual contribution heatmap. Track daily focus hours, plan study milestones, and boost academic productivity with local-first privacy.",
  keywords: [
    "pomodoro timer",
    "study tracker",
    "aesthetic pomodoro timer",
    "online study timer",
    "study habit tracker",
    "github style study heatmap",
    "focus timer with tasks",
    "study hours tracker",
    "free pomodoro timer",
    "pomodoro technique online",
    "student productivity tracker",
    "stopwatch study timer",
    "minimalist study timer",
    "aesthetic study clock"
  ],
  authors: [{ name: "StudiesTimer Team" }],
  creator: "StudiesTimer",
  publisher: "StudiesTimer",
  applicationName: "StudiesTimer",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "StudiesTimer",
    title: "StudiesTimer - Aesthetic Pomodoro Timer, Study Habits & Heatmap",
    description:
      "Free aesthetic online Pomodoro timer, study habit tracker, and GitHub-style contribution heatmap. Track daily focus hours and boost productivity.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "StudiesTimer - Aesthetic Pomodoro Timer & Study Habits Heatmap",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StudiesTimer - Aesthetic Pomodoro Timer, Study Habits & Heatmap",
    description:
      "Free aesthetic online Pomodoro timer, study habit tracker, and GitHub-style contribution heatmap. Track daily focus hours and boost productivity.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
  category: "productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        "name": "StudiesTimer",
        "url": SITE_URL,
        "description": "Free aesthetic online Pomodoro timer, study habit tracker, and GitHub-style contribution heatmap. Boost focus, manage study tasks, and visualize daily academic progress.",
        "applicationCategory": "ProductivityApplication",
        "operatingSystem": "All",
        "browserRequirements": "Requires JavaScript. Requires HTML5.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "featureList": [
          "Aesthetic Pomodoro Timer with Focus, Short Break, and Long Break intervals",
          "Stopwatch Open Study Mode with one-click Stop & Record",
          "Interactive 7-Day Study Chart with minutes and hours conversion",
          "Weekly Habits Tracker with streak counting",
          "GitHub-style annual study contribution heatmap",
          "Study Task Management with Pomodoro estimations",
          "Local-first IndexedDB privacy with Markdown and SQL export"
        ]
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        "url": SITE_URL,
        "name": "StudiesTimer",
        "description": "Aesthetic Pomodoro Timer, Study Tracker & Habit Heatmap",
        "inLanguage": "en-US"
      }
    ]
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
