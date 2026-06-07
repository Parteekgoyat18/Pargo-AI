import "./globals.css";

export const metadata = {
  title: "Pargo AI — AI Booking Assistant",
  description: "Your personal AI concierge for hotel bookings worldwide",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full overflow-hidden" suppressHydrationWarning>{children}</body>
    </html>
  );
}
