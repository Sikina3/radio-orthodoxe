import "./globals.css";

export const metadata = {
  title: "Radio Orthodoxe | La Voix de la Foi",
  description: "Écoutez en direct Radio Orthodoxe, votre radio web personnelle pour la spiritualité et la paix.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  );
}
