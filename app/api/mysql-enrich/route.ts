import { NextResponse } from "next/server";
import pool from "@/lib/mysqlPool";

export const dynamic = "force-dynamic";

const QUERY = `
WITH HistoricoNumerado AS (
    SELECT
        r.CodHistorico,
        r.IdRequisicao,
        rs.Codrequisicao,
        r.Codevento,
        r.DtaEvento,
        rs.CodPrioridade,
        ROW_NUMBER() OVER(PARTITION BY r.IdRequisicao ORDER BY r.DtaEvento DESC) as rn
    FROM
        requisicaohistorico as r
    INNER JOIN
        requisicao as rs ON r.IdRequisicao = rs.IdRequisicao
    WHERE
        r.DtaEvento >= CURRENT_DATE() - INTERVAL 5 DAY
)
SELECT
    CodHistorico,
    IdRequisicao,
    Codrequisicao,
    Codevento,
    DtaEvento,
    CodPrioridade
FROM
    HistoricoNumerado
WHERE
    rn = 1;
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

    const result = (
      rows as {
        Codrequisicao: string;
        Codevento: string | number;
        DtaEvento: string | Date;
        CodPrioridade: string | number;
      }[]
    ).reduce<{ cod_requisicao: string; dta_status: string; cod_evento_status: string; cod_prioridade: string }[]>(
      (acc, row) => {
        if (!row.Codrequisicao || !row.DtaEvento) return acc;
        const raw = row.DtaEvento;
        const iso =
          raw instanceof Date
            ? raw.toISOString().slice(0, 10)
            : String(raw).slice(0, 10);
        acc.push({
          cod_requisicao: String(row.Codrequisicao),
          dta_status: iso,
          cod_evento_status: String(row.Codevento ?? ""),
          cod_prioridade: String(row.CodPrioridade ?? ""),
        });
        return acc;
      },
      [],
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
