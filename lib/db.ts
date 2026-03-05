import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');
const FILTERS_DIR = path.join(DB_DIR, 'filters');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(FILTERS_DIR)) fs.mkdirSync(FILTERS_DIR, { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('cache_size = -64000');
  }
  return _db;
}

// --- Column definitions (fixed schema) ---

export interface ColumnDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export const COLUMNS: ColumnDef[] = [
  { name: 'ano', label: 'Ano', type: 'number' },
  { name: 'mes', label: 'Mes', type: 'text' },
  { name: 'id_laboratorio', label: 'IdLaboratorio', type: 'number' },
  { name: 'nom_laboratorio', label: 'NomLaboratorio', type: 'text' },
  { name: 'id_unidade', label: 'IdUnidade', type: 'number' },
  { name: 'nom_unidade', label: 'NomUnidade', type: 'text' },
  { name: 'id_fonte_pagadora', label: 'IdFontePagadora', type: 'number' },
  { name: 'nom_fonte_pagadora', label: 'NomFontePagadora', type: 'text' },
  { name: 'id_segmento', label: 'IdSegmento', type: 'number' },
  { name: 'nom_segmento', label: 'NomSegmento', type: 'text' },
  { name: 'id_local_origem', label: 'IdLocalOrigem', type: 'number' },
  { name: 'nom_local_origem', label: 'NomLocalOrigem', type: 'text' },
  { name: 'id_segmento_local', label: 'IdSegmentoLocal', type: 'number' },
  { name: 'nom_segmento_local', label: 'NomSegmentoLocal', type: 'text' },
  { name: 'setor_local', label: 'SetorLocal', type: 'text' },
  { name: 'id_convenio', label: 'IdConvenio', type: 'number' },
  { name: 'nom_convenio', label: 'NomConvenio', type: 'text' },
  { name: 'lote', label: 'Lote', type: 'text' },
  { name: 'id_pre_fatura', label: 'IdPreFatura', type: 'text' },
  { name: 'dta_vencimento', label: 'DtaVencimento', type: 'date' },
  { name: 'id_requisicao', label: 'IdRequisicao', type: 'number' },
  { name: 'cod_requisicao', label: 'CodRequisicao', type: 'text' },
  { name: 'dta_solicitacao', label: 'DtaSolicitacao', type: 'date' },
  { name: 'dta_emissao_pedido', label: 'DtaEmissaoPedido', type: 'date' },
  { name: 'dta_finalizacao', label: 'DtaFinalizacao', type: 'date' },
  { name: 'dta_prevista', label: 'DtaPrevista', type: 'date' },
  { name: 'dta_coleta', label: 'DtaColeta', type: 'date' },
  { name: 'dta_inclusao_lote', label: 'DtaInclusaoLote', type: 'date' },
  { name: 'num_guia_convenio', label: 'NumGuiaConvenio', type: 'text' },
  { name: 'mat_convenio', label: 'MatConvenio', type: 'text' },
  { name: 'num_externo', label: 'NumExterno', type: 'text' },
  { name: 'cod_medico', label: 'CodMedico', type: 'text' },
  { name: 'nom_medico', label: 'NomMedico', type: 'text' },
  { name: 'crm', label: 'CRM', type: 'text' },
  { name: 'cod_paciente', label: 'CodPaciente', type: 'text' },
  { name: 'nom_paciente', label: 'NomPaciente', type: 'text' },
  { name: 'cns_paciente', label: 'CnsPaciente', type: 'text' },
  { name: 'cod_exame', label: 'CodExame', type: 'text' },
  { name: 'nom_exame', label: 'NomExame', type: 'text' },
  { name: 'cod_evento', label: 'CodEvento', type: 'text' },
  { name: 'nom_evento', label: 'NomEvento', type: 'text' },
  { name: 'cod_evento_fatur', label: 'CodEventoFatur', type: 'text' },
  { name: 'nom_evento_fatur', label: 'NomEventoFatur', type: 'text' },
  { name: 'paciente_internado', label: 'PacienteInternado', type: 'text' },
  { name: 'cod_exame_tipo', label: 'CodExameTipo', type: 'text' },
  { name: 'nom_exame_tipo', label: 'NomExameTipo', type: 'text' },
  { name: 'id_executivo_conta', label: 'IdExecutivoConta', type: 'text' },
  { name: 'nom_executivo_conta', label: 'NomExecutivoConta', type: 'text' },
  { name: 'nfe_numero', label: 'NFeNumero', type: 'text' },
  { name: 'rps_lote', label: 'RPSLote', type: 'text' },
  { name: 'rps_req', label: 'RPSReq', type: 'text' },
  { name: 'nfe_req', label: 'NFeReq', type: 'text' },
  { name: 'id_patologista', label: 'IdPatologista', type: 'text' },
  { name: 'nom_patologista', label: 'NomPatologista', type: 'text' },
  { name: 'sus_patologista', label: 'SusPatologista', type: 'text' },
  { name: 'qtd_top', label: 'QtdTop', type: 'number' },
  { name: 'qtd_blo', label: 'QtdBlo', type: 'number' },
  { name: 'qtd_lam', label: 'QtdLam', type: 'number' },
  { name: 'qtd_anticorpo', label: 'QtdAnticorpo', type: 'number' },
  { name: 'qtd_frasco', label: 'QtdFrasco', type: 'number' },
  { name: 'qtd_saco', label: 'QtdSaco', type: 'number' },
  { name: 'adm_qtd_saco', label: 'AdmQtdSaco', type: 'number' },
  { name: 'adm_qtd_frasco', label: 'AdmQtdFrasco', type: 'number' },
  { name: 'adm_qtd_bloco', label: 'AdmQtdBloco', type: 'number' },
  { name: 'adm_qtd_lamina', label: 'AdmQtdLamina', type: 'number' },
  { name: 'campo3', label: 'Campo3', type: 'text' },
  { name: 'campo4', label: 'Campo4', type: 'text' },
  { name: 'campo6', label: 'Campo6', type: 'text' },
  { name: 'campo8', label: 'Campo8', type: 'text' },
  { name: 'nom_tabela', label: 'NomTabela', type: 'text' },
  { name: 'cod_cobranca', label: 'CodCobranca', type: 'text' },
  { name: 'nom_cobranca', label: 'NomCobranca', type: 'text' },
  { name: 'apl_cobranca', label: 'AplCobranca', type: 'text' },
  { name: 'qtd_cobranca', label: 'QtdCobranca', type: 'number' },
  { name: 'vlr_bruto', label: 'VlrBruto', type: 'number' },
  { name: 'vlr_liquido', label: 'VlrLiquido', type: 'number' },
  { name: 'vlr_recebido', label: 'VlrRecebido', type: 'number' },
  { name: 'dta_recebido', label: 'DtaRecebido', type: 'text' },
  { name: 'id_motivo_glosa', label: 'IdMotivoGlosa', type: 'text' },
  { name: 'des_motivo_glosa', label: 'DesMotivoGlosa', type: 'text' },
  { name: 'id_exame_tipo', label: 'IdExameTipo', type: 'text' },
  { name: 'fat_exame_tipo', label: 'FatExameTipo', type: 'text' },
  { name: 'senha_autorizacao_proc', label: 'SenhaAutorizacaoProc', type: 'text' },
  { name: 'dta_autorizacao_proc', label: 'DtaAutorizacaoProc', type: 'date' },
  { name: 'num_guia_proc', label: 'NumGuiaProc', type: 'text' },
  { name: 'senha_autorizacao_req', label: 'SenhaAutorizacaoReq', type: 'text' },
  { name: 'dta_autorizacao_req', label: 'DtaAutorizacaoReq', type: 'date' },
];

// Map from CSV header to db column name
const HEADER_MAP: Record<string, string> = {};
COLUMNS.forEach(c => {
  HEADER_MAP[c.label.toLowerCase()] = c.name;
});

// --- Table creation ---

export function ensureTable() {
  const db = getDb();
  const colDefs = COLUMNS.map(c => {
    const sqlType = c.type === 'number' ? 'REAL' : 'TEXT';
    return `"${c.name}" ${sqlType}`;
  }).join(',\n  ');

  db.exec(`CREATE TABLE IF NOT EXISTS csv_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ${colDefs}
)`);

  // Create indexes on commonly filtered columns
  const indexCols = [
    'nom_convenio', 'nom_exame', 'nom_paciente', 'nom_medico',
    'dta_solicitacao', 'dta_coleta', 'dta_finalizacao', 'dta_vencimento',
    'nom_fonte_pagadora', 'nom_segmento', 'nom_unidade', 'nom_laboratorio',
    'vlr_bruto', 'vlr_liquido', 'vlr_recebido', 'ano', 'mes',
    'nom_exame_tipo', 'nom_evento', 'nom_cobranca',
  ];
  for (const col of indexCols) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${col} ON csv_data("${col}")`);
  }
}

// --- CSV Import ---

export function importCSV(headers: string[], rows: string[][]): { rowCount: number; skipped: number } {
  const db = getDb();
  ensureTable();

  // This CSV export omits 'SetorLocal' from the header but includes it as an
  // empty column in every data row (between NomSegmentoLocal and IdConvenio).
  // Without correction this creates a +1 shift for every column from IdConvenio
  // onwards, causing NomPatologista to land in the QtdCobranca (numeric) slot
  // and be silently discarded. We inject the missing header here to realign.
  const hasSetorLocal = headers.some(h => h.trim().toLowerCase() === 'setorlocal');
  if (!hasSetorLocal) {
    const nomSegLocalIdx = headers.findIndex(h => h.trim().toLowerCase() === 'nomsegmentolocal');
    if (nomSegLocalIdx >= 0) {
      headers.splice(nomSegLocalIdx + 1, 0, 'SetorLocal');
    }
  }

  // Map CSV headers to column names
  const colMapping: { csvIndex: number; dbCol: string; colDef: ColumnDef }[] = [];
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    const dbName = HEADER_MAP[key];
    if (dbName) {
      const colDef = COLUMNS.find(c => c.name === dbName)!;
      colMapping.push({ csvIndex: i, dbCol: dbName, colDef });
    }
  });

  if (colMapping.length === 0) {
    throw new Error('Nenhuma coluna do CSV corresponde ao schema esperado');
  }

  // Clear existing data and reimport
  db.exec('DELETE FROM csv_data');

  const dbCols = colMapping.map(m => `"${m.dbCol}"`).join(', ');
  const placeholders = colMapping.map(() => '?').join(', ');
  const insertStmt = db.prepare(
    `INSERT INTO csv_data (${dbCols}) VALUES (${placeholders})`
  );

  let imported = 0;
  let skipped = 0;

  const insertBatch = db.transaction((batch: string[][]) => {
    for (const row of batch) {
      try {
        const values = colMapping.map(m => {
          const raw = (row[m.csvIndex] || '').trim();
          if (!raw) return null;
          if (m.colDef.type === 'number') {
            const num = parseFloat(raw.replace(',', '.'));
            return isNaN(num) ? null : num;
          }
          return raw;
        });
        insertStmt.run(...values);
        imported++;
      } catch {
        skipped++;
      }
    }
  });

  const CHUNK = 5000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    insertBatch(rows.slice(i, i + CHUNK));
  }

  return { rowCount: imported, skipped };
}

// --- Query ---

export interface FilterCondition {
  column: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'date_after' | 'date_before' | 'date_between' | 'is_today' | 'is_future' | 'is_past';
  value: string | number;
  value2?: string | number;
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  selectedColumns: string[];
  conditions: FilterCondition[];
  colorRules?: import('./types').ColorRule[];
  formulaColumns?: import('./types').FormulaColumn[];
  createdAt: string;
  updatedAt?: string;
}

function buildWhereClause(conditions: FilterCondition[]): { sql: string; params: any[] } {
  if (!conditions.length) return { sql: '', params: [] };

  const clauses: string[] = [];
  const params: any[] = [];

  for (const c of conditions) {
    const col = `"${c.column}"`;
    switch (c.operator) {
      case 'equals':
        if (c.value === '' || c.value == null) {
          clauses.push(`(${col} IS NULL OR ${col} = '')`);
        } else {
          clauses.push(`${col} = ?`); params.push(c.value);
        }
        break;
      case 'not_equals':
        if (c.value === '' || c.value == null) {
          clauses.push(`(${col} IS NOT NULL AND ${col} != '')`);
        } else {
          clauses.push(`${col} != ?`); params.push(c.value);
        }
        break;
      case 'contains':
        clauses.push(`${col} LIKE ?`); params.push(`%${c.value}%`); break;
      case 'not_contains':
        clauses.push(`${col} NOT LIKE ?`); params.push(`%${c.value}%`); break;
      case 'gt':
        clauses.push(`CAST(${col} AS REAL) > ?`); params.push(Number(c.value)); break;
      case 'gte':
        clauses.push(`CAST(${col} AS REAL) >= ?`); params.push(Number(c.value)); break;
      case 'lt':
        clauses.push(`CAST(${col} AS REAL) < ?`); params.push(Number(c.value)); break;
      case 'lte':
        clauses.push(`CAST(${col} AS REAL) <= ?`); params.push(Number(c.value)); break;
      case 'between':
        clauses.push(`CAST(${col} AS REAL) BETWEEN ? AND ?`);
        params.push(Number(c.value), Number(c.value2)); break;
      case 'in': {
        const vals = String(c.value).split(',').map(v => v.trim());
        clauses.push(`${col} IN (${vals.map(() => '?').join(',')})`);
        params.push(...vals); break;
      }
      case 'not_in': {
        const vals = String(c.value).split(',').map(v => v.trim());
        clauses.push(`${col} NOT IN (${vals.map(() => '?').join(',')})`);
        params.push(...vals); break;
      }
      case 'is_null':
        clauses.push(`(${col} IS NULL OR ${col} = '')`); break;
      case 'is_not_null':
        clauses.push(`(${col} IS NOT NULL AND ${col} != '')`); break;
      case 'date_after':
        clauses.push(`${col} >= ?`); params.push(c.value); break;
      case 'date_before':
        clauses.push(`${col} <= ?`); params.push(c.value); break;
      case 'date_between':
        clauses.push(`${col} BETWEEN ? AND ?`);
        params.push(c.value, c.value2); break;
      case 'is_today': {
        const today = new Date().toISOString().split('T')[0];
        clauses.push(`DATE(${col}) = ?`); params.push(today); break;
      }
      case 'is_today_or_tomorrow': {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) BETWEEN ? AND ?)`);
        params.push(today, tomorrow); break;
      }
      case 'is_future': {
        const today = new Date().toISOString().split('T')[0];
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) > ?)`); params.push(today); break;
      }
      case 'is_future_or_today': {
        const today = new Date().toISOString().split('T')[0];
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) >= ?)`); params.push(today); break;
      }
      case 'is_past': {
        const today = new Date().toISOString().split('T')[0];
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) < ?)`); params.push(today); break;
      }
      case 'is_past_or_today': {
        const today = new Date().toISOString().split('T')[0];
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) <= ?)`); params.push(today); break;
      }
    }
  }

  return { sql: `WHERE ${clauses.join(' AND ')}`, params };
}

export function queryFiltered(
  selectedColumns: string[],
  conditions: FilterCondition[],
  page = 1,
  pageSize = 50,
  sortColumn?: string,
  sortDir: 'asc' | 'desc' = 'asc'
) {
  const db = getDb();
  const cols = selectedColumns.length
    ? selectedColumns.map(c => `"${c}"`).join(', ')
    : '*';
  const { sql: where, params } = buildWhereClause(conditions);
  const hasSpecificCols = selectedColumns.length > 0;
  const groupBy = hasSpecificCols ? `GROUP BY ${cols}` : '';
  const orderBy = sortColumn
    ? `ORDER BY "${sortColumn}" ${sortDir}`
    : hasSpecificCols ? 'ORDER BY MIN(id)' : 'ORDER BY id';
  const offset = (page - 1) * pageSize;

  const countSql = hasSpecificCols
    ? `SELECT COUNT(*) as total FROM (SELECT 1 FROM csv_data ${where} ${groupBy})`
    : `SELECT COUNT(*) as total FROM csv_data ${where}`;

  const { total } = db.prepare(countSql).get(...params) as any;
  const rows = db.prepare(`SELECT ${cols} FROM csv_data ${where} ${groupBy} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  return { rows, total };
}

export function getDistinctValues(column: string, limit = 200): string[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT DISTINCT "${column}" FROM csv_data WHERE "${column}" IS NOT NULL AND "${column}" != '' ORDER BY "${column}" LIMIT ?`
  ).all(limit) as any[];
  return rows.map(r => String(r[column]));
}

export function getTableStats() {
  const db = getDb();
  try {
    const { total } = db.prepare('SELECT COUNT(*) as total FROM csv_data').get() as any;
    const dateRange = db.prepare(
      'SELECT MIN(dta_solicitacao) as min_date, MAX(dta_solicitacao) as max_date FROM csv_data WHERE dta_solicitacao IS NOT NULL'
    ).get() as any;
    return { total, minDate: dateRange?.min_date, maxDate: dateRange?.max_date };
  } catch {
    return { total: 0, minDate: null, maxDate: null };
  }
}

// --- Export filtered CSV ---

export function exportFilteredCSV(selectedColumns: string[], conditions: FilterCondition[]): string {
  const db = getDb();
  const cols = selectedColumns.length
    ? selectedColumns.map(c => `"${c}"`).join(', ')
    : '*';
  const { sql: where, params } = buildWhereClause(conditions);
  const hasSpecificCols = selectedColumns.length > 0;
  const groupBy = hasSpecificCols ? `GROUP BY ${cols}` : '';
  const orderBy = hasSpecificCols ? 'ORDER BY MIN(id)' : 'ORDER BY id';
  const rows = db.prepare(`SELECT ${cols} FROM csv_data ${where} ${groupBy} ${orderBy}`).all(...params) as any[];

  if (!rows.length) return '';

  const headers = Object.keys(rows[0]);
  // Map back to original labels
  const headerLabels = headers.map(h => {
    const col = COLUMNS.find(c => c.name === h);
    return col ? col.label : h;
  });

  const lines = [headerLabels.join(';')];
  for (const row of rows) {
    const vals = headers.map(h => {
      const v = String(row[h] ?? '');
      return v.includes(';') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"` : v;
    });
    lines.push(vals.join(';'));
  }
  return lines.join('\n');
}

// --- Saved Filters (JSON files) ---

export function getSavedFilters(): SavedFilter[] {
  const files = fs.readdirSync(FILTERS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = fs.readFileSync(path.join(FILTERS_DIR, f), 'utf-8');
    return JSON.parse(data) as SavedFilter;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveFilterToFile(filter: SavedFilter): void {
  filter.updatedAt = new Date().toISOString();
  const filePath = path.join(FILTERS_DIR, `${filter.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(filter, null, 2));
}

export function deleteFilterFile(id: string): void {
  const filePath = path.join(FILTERS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function getFilterById(id: string): SavedFilter | null {
  const filePath = path.join(FILTERS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// --- Patologistas ---

export function getDistinctPatologists(): string[] {
  const db = getDb();
  try {
    const rows = db.prepare(
      `SELECT DISTINCT nom_patologista FROM csv_data
       WHERE nom_patologista IS NOT NULL AND nom_patologista != ''
       ORDER BY nom_patologista`
    ).all() as any[];
    return rows.map(r => String(r.nom_patologista));
  } catch {
    return [];
  }
}

export interface PatologistaSummary {
  total: number;
  eventos: { nome_evento: string; count: number }[];
}

export function getPatologistaSummary(
  conditions: FilterCondition[],
  patologistaNome: string
): PatologistaSummary {
  const db = getDb();
  const { sql: where, params } = buildWhereClause(conditions);

  const patCond = where
    ? `${where} AND "nom_patologista" = ?`
    : `WHERE "nom_patologista" = ?`;
  const allParams = [...params, patologistaNome];

  const { total } = db.prepare(
    `SELECT COUNT(*) as total FROM csv_data ${patCond}`
  ).get(...allParams) as any;

  const eventoRows = db.prepare(
    `SELECT nom_evento_fatur as nome_evento, COUNT(*) as count
     FROM csv_data ${patCond}
     AND nom_evento_fatur IS NOT NULL AND nom_evento_fatur != ''
     GROUP BY nom_evento_fatur
     ORDER BY count DESC`
  ).all(...allParams) as any[];

  return {
    total: total ?? 0,
    eventos: eventoRows.map(r => ({ nome_evento: String(r.nome_evento), count: Number(r.count) })),
  };
}

export interface PatologistaRows {
  columns: { name: string; label: string; type: string }[];
  rows: Record<string, string>[];
}

export function getPatologistaRows(
  conditions: FilterCondition[],
  selectedColumns: string[],
  patologistaNome: string
): PatologistaRows {
  const db = getDb();
  const { sql: where, params } = buildWhereClause(conditions);
  const patCond = where
    ? `${where} AND "nom_patologista" = ?`
    : `WHERE "nom_patologista" = ?`;
  const allParams = [...params, patologistaNome];

  const cols = selectedColumns.length ? selectedColumns : COLUMNS.map(c => c.name);
  const colsSql = cols.map(c => `"${c}"`).join(', ');

  const groupBy = `GROUP BY ${colsSql}`;
  const rows = db.prepare(
    `SELECT ${colsSql} FROM csv_data ${patCond} ${groupBy} ORDER BY MIN(id)`
  ).all(...allParams) as any[];

  const columnDefs = cols.map(name => {
    const def = COLUMNS.find(c => c.name === name);
    return { name, label: def?.label ?? name, type: def?.type ?? 'text' };
  });

  return {
    columns: columnDefs,
    rows: rows.map(r => {
      const obj: Record<string, string> = {};
      for (const col of cols) obj[col] = String(r[col] ?? '');
      return obj;
    }),
  };
}
