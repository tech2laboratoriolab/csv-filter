import { NextResponse } from "next/server";
import pool from "@/lib/mysqlPool";

export const dynamic = "force-dynamic";

const QUERY = `
SELECT
  req.CodRequisicao,
  rec.DtaRecibo,
  rec.Valor,
  rec.NotaFiscal,
  rec.Nome,
  rec.DtaCancel,
  rec.IdUsuarioCancel,
  rec.Proveniencia
FROM lab.recibo rec
INNER JOIN lab.reciborequisicao rr ON rec.idrecibo = rr.idrecibo
INNER JOIN lab.requisicao req ON rr.idrequisicao = req.IdRequisicao
WHERE req.DtaSolicitacao >= CURDATE() - INTERVAL 30 DAY
ORDER BY req.CodRequisicao
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

    const result = (rows as any[]).map((row) => ({
      cod_requisicao: String(row.CodRequisicao),
      dta_recibo:
        row.DtaRecibo instanceof Date
          ? row.DtaRecibo.toISOString().slice(0, 10)
          : row.DtaRecibo
            ? String(row.DtaRecibo).slice(0, 10)
            : null,
      vlr_recibo: row.Valor != null ? Number(row.Valor) : null,
      nota_fiscal_recibo: row.NotaFiscal ? String(row.NotaFiscal) : null,
      nom_recibo: row.Nome ? String(row.Nome) : null,
      dta_cancel_recibo:
        row.DtaCancel instanceof Date
          ? row.DtaCancel.toISOString().slice(0, 10)
          : row.DtaCancel
            ? String(row.DtaCancel).slice(0, 10)
            : null,
      id_usuario_cancel:
        row.IdUsuarioCancel != null ? String(row.IdUsuarioCancel) : null,
      proveniencia: row.Proveniencia ? String(row.Proveniencia) : null,
    }));

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
