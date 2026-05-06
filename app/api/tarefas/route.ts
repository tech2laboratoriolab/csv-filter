import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysqlPool";

export const dynamic = "force-dynamic";

const QUERY = `
SELECT
  r.CodRequisicao,
  t.CodTarefa,
  tt.DesTarefaTipo,
  t.DtaLimite,
  t.DtaInclusao,
  t.MsgTarefa,
  ar.LoginUsuario AS Remetente,
  ad.LoginUsuario AS Destinatario
FROM tarefa AS t
INNER JOIN requisicao AS r ON r.IdRequisicao = t.IdRequisicao
INNER JOIN autusuario AS ar ON ar.IdUsuario = t.IdRemetente
INNER JOIN autusuario AS ad ON ad.IdUsuario = t.IdDestinatario
LEFT JOIN tarefatipo AS tt ON tt.CodTarefaTipo = t.CodTarefaTipo
WHERE TRIM(r.CodRequisicao) = ?
ORDER BY t.DtaInclusao DESC
`;

export async function GET(req: NextRequest) {
  const codRequisicao = req.nextUrl.searchParams.get("codRequisicao");

  if (!codRequisicao || !codRequisicao.trim()) {
    return NextResponse.json(
      { error: "Parâmetro codRequisicao é obrigatório" },
      { status: 400 },
    );
  }

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
    const [rows] = await pool.execute(QUERY, [codRequisicao.trim()]);

    const tarefas = (
      rows as {
        CodRequisicao: string;
        CodTarefa: number;
        DesTarefaTipo: string | null;
        DtaLimite: string | Date | null;
        DtaInclusao: string | Date | null;
        MsgTarefa: string | null;
        Remetente: string;
        Destinatario: string;
      }[]
    ).map((r) => ({
      codRequisicao: r.CodRequisicao,
      codTarefa: r.CodTarefa,
      codTarefaTipo: r.DesTarefaTipo ?? null,
      dtaLimite: r.DtaLimite ? String(r.DtaLimite) : null,
      dtaInclusao: r.DtaInclusao ? String(r.DtaInclusao) : null,
      msgTarefa: r.MsgTarefa ?? "",
      remetente: r.Remetente,
      destinatario: r.Destinatario,
    }));

    return NextResponse.json(tarefas);
  } catch (err) {
    console.error("[tarefas] MySQL error:", err);
    return NextResponse.json(
      { error: "Erro ao consultar tarefas" },
      { status: 500 },
    );
  }
}
