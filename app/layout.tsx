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
          src="http://85.239.246.101:3000/script.js"
          data-website-id="1a5f20c2-309f-4c7a-88f8-1d278966bbe2"
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
