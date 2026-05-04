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
          src="/umami/script.js"
          data-website-id="0079c6e7-052d-4ced-abb0-ed0e81239a80"
          data-host-url="/umami"
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
