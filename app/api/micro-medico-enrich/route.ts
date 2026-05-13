import { NextResponse } from "next/server";
import pool from "@/lib/mysqlPool";

export const dynamic = "force-dynamic";

const QUERY = `
WITH UltimoAcesso AS (
    SELECT
        u.IdRequisicao,
        u.DtaEvento,
        ROW_NUMBER() OVER(PARTITION BY u.idRequisicao ORDER BY u.DtaEvento DESC) as rn
    FROM
        usuariologacesso as u
    WHERE
        u.DtaEvento >= CURDATE() - INTERVAL 30 DAY
        AND u.Evento LIKE '[MIC] V%'
)
SELECT
    req.CodRequisicao,
    ua.DtaEvento
FROM
    UltimoAcesso ua
INNER JOIN
    requisicao req ON req.IdRequisicao = ua.IdRequisicao
WHERE
    ua.rn = 1;
`;

export async function GET() {
  if (
    !process.env.MYSQL_HOST ||
    !process.env.MYSQL_USER ||
    !process.env.MYSQL_PASSWORD
  ) {
    return NextResponse.json(
      { error: "Variáveis de ambiente MySQL não configuradas" },
      { status: 500 },
    );
  }

  try {
    const [rows] = await pool.execute(QUERY);

    const result = (rows as { CodRequisicao: string; DtaEvento: string | Date }[])
      .filter((row) => row.CodRequisicao && row.DtaEvento)
      .map((row) => {
        const raw = row.DtaEvento;
        const iso =
          raw instanceof Date
            ? raw.toISOString().slice(0, 10)
            : String(raw).slice(0, 10);
        return {
          cod_requisicao: String(row.CodRequisicao),
          dta_micro_medico: iso,
        };
      });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
