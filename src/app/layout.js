import "./globals.css";

export const metadata = {
  title: "Pargo AI — AI Booking Assistant",
  description: "Your personal AI concierge for hotel bookings worldwide",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
