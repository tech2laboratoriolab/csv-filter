import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSV Filter Pro — LAB",
  description: "Filtro e visualização de dados de faturamento",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          defer
          src="http://localhost:3000/script.js"
          data-website-id="7450f8d1-e879-4eaf-992a-dcf595730746"
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
