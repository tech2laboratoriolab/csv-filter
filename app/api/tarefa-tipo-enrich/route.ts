import { NextResponse } from "next/server";
import pool from "@/lib/mysqlPool";

export const dynamic = "force-dynamic";

const QUERY = `
SELECT
  r.CodRequisicao,
  t.CodTarefaTipo
FROM tarefa AS t
INNER JOIN requisicao AS r ON r.IdRequisicao = t.IdRequisicao
WHERE t.CodTarefaTipo = 10
AND t.DtaInclusao >= CURDATE() - INTERVAL 30 DAY
ORDER BY r.CodRequisicao
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
      rows as { CodRequisicao: string; CodTarefaTipo: number | null }[]
    ).map((r) => ({
      cod_requisicao: r.CodRequisicao,
      cod_tarefa_tipo: r.CodTarefaTipo ?? null,
    }));

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
