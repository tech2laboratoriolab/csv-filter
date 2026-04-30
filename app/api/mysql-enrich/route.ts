import { NextResponse } from "next/server";
import pool from "@/lib/mysqlPool";

export const dynamic = "force-dynamic";

// const QUERY = `
// SELECT
//     TRIM(SUBSTRING(u.Evento, LOCATE('Para:', u.Evento) + 5)) AS evento,
//     r.CodRequisicao,
//     r.DtaSolicitacao
// FROM
//     lab.usuariologacesso AS u
// INNER JOIN
//     lab.requisicao AS r ON u.IdRequisicao = r.IdRequisicao
// WHERE
//     r.DtaSolicitacao >= CURRENT_DATE - INTERVAL 2 DAY
//     AND u.Evento LIKE 'Alteração status%'
// ORDER BY
//     r.DtaSolicitacao
// `;

const QUERY = `
SELECT * FROM (
    SELECT
        TRIM(SUBSTRING(u.Evento, LOCATE('Para:', u.Evento) + 5)) AS evento,
        r.CodRequisicao,
        r.DtaSolicitacao,
        r.CodPrioridade,
        ROW_NUMBER() OVER (
            PARTITION BY r.CodRequisicao
            ORDER BY r.DtaSolicitacao DESC, u.NumEvento DESC
        ) as rn
    FROM
        lab.usuariologacesso AS u
    INNER JOIN
        lab.requisicao AS r ON u.IdRequisicao = r.IdRequisicao
    WHERE
        u.Evento LIKE 'Alteração status%'
        AND r.DtaSolicitacao >= CURDATE() - INTERVAL 10 DAY
) AS ranked_logs
WHERE rn = 1
ORDER BY CodRequisicao;
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

    // Keep only the last row per CodRequisicao (query is ordered ASC, so last = most recent)
    const dedupMap = new Map<
      string,
      { dta_status: string; nom_evento_status: string; cod_prioridade: string }
    >();
    for (const row of rows as {
      evento: string;
      CodRequisicao: string;
      DtaSolicitacao: string | Date;
      CodPrioridade?: string | number;
    }[]) {
      if (row.CodRequisicao && row.DtaSolicitacao) {
        const raw = row.DtaSolicitacao;
        const iso =
          raw instanceof Date
            ? raw.toISOString().slice(0, 10)
            : String(raw).slice(0, 10);
        dedupMap.set(String(row.CodRequisicao), {
          dta_status: iso,
          nom_evento_status: row.evento ?? "",
          cod_prioridade: String(row.CodPrioridade ?? ""),
        });
      }
    }

    const result = Array.from(dedupMap.entries()).map(
      ([cod_requisicao, v]) => ({
        cod_requisicao,
        dta_status: v.dta_status,
        nom_evento_status: v.nom_evento_status,
        cod_prioridade: v.cod_prioridade,
      }),
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
