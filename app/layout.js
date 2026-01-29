import "./globals.css";

export const metadata = {
  title: "RTO - Radio Toamasina Orthodoxe",
  description: "La Voix de la Foi, l'Écho de la Paix - Radio Toamasina Orthodoxe",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
