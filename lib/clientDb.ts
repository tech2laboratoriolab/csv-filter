import initSqlJs, { Database } from 'sql.js';
import { openDB, IDBPDatabase } from 'idb';

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

const HEADER_MAP: Record<string, string> = {};
COLUMNS.forEach(c => {
  HEADER_MAP[c.label.toLowerCase()] = c.name;
});

// --- In-Memory SQLite Setup ---
let _dbPromise: Promise<Database> | null = null;

function createEmptyDb(SQL: any): Database {
  const colDefs = COLUMNS.map(c => {
    const sqlType = c.type === 'number' ? 'REAL' : 'TEXT';
    return `"${c.name}" ${sqlType}`;
  }).join(',\n  ');

  const db = new SQL.Database();
  db.run(`CREATE TABLE csv_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${colDefs}
  )`);

  const indexCols = [
    'nom_convenio', 'nom_exame', 'nom_paciente', 'nom_medico',
    'dta_solicitacao', 'dta_coleta', 'dta_finalizacao', 'dta_vencimento',
    'nom_fonte_pagadora', 'nom_segmento', 'nom_unidade', 'nom_laboratorio',
    'vlr_bruto', 'vlr_liquido', 'vlr_recebido', 'ano', 'mes',
    'nom_exame_tipo', 'nom_evento', 'nom_cobranca',
  ];
  for (const col of indexCols) {
    db.run(`CREATE INDEX idx_${col} ON csv_data("${col}")`);
  }
  return db;
}

export function getDb(): Promise<Database> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const wasmResponse = await fetch('/sql-wasm.wasm');
      if (!wasmResponse.ok) {
        throw new Error(`Failed to fetch sql-wasm.wasm: ${wasmResponse.statusText}`);
      }
      const wasmBinary = await wasmResponse.arrayBuffer();
      const SQL = await initSqlJs({ wasmBinary });

      // Try to restore persisted database from IndexedDB
      const idb = await getIdb();
      if (idb) {
        const snapshot = await idb.get('csv_database', 'snapshot') as Uint8Array | undefined;
        if (snapshot) {
          return new SQL.Database(snapshot);
        }
      }

      return createEmptyDb(SQL);
    })();
  }
  return _dbPromise;
}

// Map sql.js output to array of objects
function resultToObjects(result: any[]): any[] {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// --- IndexedDB Setup (Persistence) ---
let idbPromise: Promise<IDBPDatabase> | null = null;
function getIdb() {
  if (typeof window === 'undefined') return null; // SSR safety
  if (!idbPromise) {
    idbPromise = openDB('csv-filter-pro', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('filters')) {
            db.createObjectStore('filters', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('annotations')) {
            db.createObjectStore('annotations');
          }
          if (!db.objectStoreNames.contains('pathologists')) {
            db.createObjectStore('pathologists', { keyPath: 'nome' });
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('csv_database')) {
            db.createObjectStore('csv_database');
          }
        }
      },
    });
  }
  return idbPromise;
}

// --- CSV Import ---
export async function importCSV(headers: string[], rows: string[][]): Promise<{ rowCount: number; skipped: number }> {
  const db = await getDb();

  const hasSetorLocal = headers.some(h => h.trim().toLowerCase() === 'setorlocal');
  if (!hasSetorLocal) {
    const nomSegLocalIdx = headers.findIndex(h => h.trim().toLowerCase() === 'nomsegmentolocal');
    if (nomSegLocalIdx >= 0) {
      headers.splice(nomSegLocalIdx + 1, 0, 'SetorLocal');
    }
  }

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

  db.run('DELETE FROM csv_data');

  const dbCols = colMapping.map(m => `"${m.dbCol}"`).join(', ');
  const placeholders = colMapping.map(() => '?').join(', ');
  
  let imported = 0;
  let skipped = 0;

  db.run('BEGIN TRANSACTION;');
  const stmt = db.prepare(`INSERT INTO csv_data (${dbCols}) VALUES (${placeholders})`);

  for (const row of rows) {
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
      stmt.run(values);
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  stmt.free();
  db.run('COMMIT;');

  // Persist snapshot to IndexedDB so data survives page navigation
  const idb = await getIdb();
  if (idb) {
    const snapshot = db.export();
    await idb.put('csv_database', snapshot, 'snapshot');
  }

  return { rowCount: imported, skipped };
}

// --- Query ---
export interface FilterCondition {
  column: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'date_after' | 'date_before' | 'date_between' | 'is_today' | 'is_future' | 'is_past' | 'is_today_or_tomorrow' | 'is_future_or_today' | 'is_past_or_today';
  value: string | number;
  value2?: string | number;
}

export interface ColorRule {
  id: string;
  name: string;
  targetType: 'row' | 'cell';
  targetColumn?: string;
  conditionColumn: string;
  operator: string;
  value: string;
  value2?: string;
  backgroundColor: string;
  textColor?: string;
  priority: number;
}

export interface FormulaColumn {
  id: string;
  label: string;
  formula: string;
  width?: number;
  insertAfterColumn?: string;
}

export interface AnnotationColumn {
  id: string;
  label: string;
  width?: number;
  insertAfterColumn?: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  selectedColumns: string[];
  conditions: FilterCondition[];
  colorRules?: ColorRule[];
  formulaColumns?: FormulaColumn[];
  annotationColumns?: AnnotationColumn[];
  whatsappLinhasColumns?: string[];
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
      case 'is_today':
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) = date('now', 'localtime'))`); break;
      case 'is_today_or_tomorrow':
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+1 day'))`); break;
      case 'is_future':
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) > date('now', 'localtime'))`); break;
      case 'is_future_or_today':
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) >= date('now', 'localtime'))`); break;
      case 'is_past':
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) < date('now', 'localtime'))`); break;
      case 'is_past_or_today':
        clauses.push(`(${col} IS NOT NULL AND DATE(${col}) <= date('now', 'localtime'))`); break;
    }
  }

  return { sql: `WHERE ${clauses.join(' AND ')}`, params };
}

export async function queryFiltered(
  selectedColumns: string[],
  conditions: FilterCondition[],
  page = 1,
  pageSize = 50,
  sortColumn?: string,
  sortDir: 'asc' | 'desc' = 'asc'
) {
  const db = await getDb();
  const hasSpecificCols = selectedColumns.length > 0;
  const cols = hasSpecificCols
    ? selectedColumns.map(c => `"${c}"`).join(', ')
    : '*';
  const rowIdExpr = hasSpecificCols ? ', MIN(id) as _row_id' : ', id as _row_id';
  const { sql: where, params } = buildWhereClause(conditions);
  const groupBy = hasSpecificCols ? `GROUP BY ${cols}` : '';
  const orderBy = sortColumn
    ? `ORDER BY "${sortColumn}" ${sortDir}`
    : hasSpecificCols ? 'ORDER BY MIN(id)' : 'ORDER BY id';
  const offset = (page - 1) * pageSize;

  const countSql = hasSpecificCols
    ? `SELECT COUNT(*) as total FROM (SELECT 1 FROM csv_data ${where} ${groupBy})`
    : `SELECT COUNT(*) as total FROM csv_data ${where}`;

  const resTotal = db.exec(countSql, params);
  const total = resTotal.length > 0 ? resTotal[0].values[0][0] : 0;

  const resRows = db.exec(`SELECT ${cols}${rowIdExpr} FROM csv_data ${where} ${groupBy} ${orderBy} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  const rows = resultToObjects(resRows);

  return { rows, total };
}

export async function getDistinctValues(column: string, limit = 200): Promise<string[]> {
  const db = await getDb();
  const res = db.exec(`SELECT DISTINCT "${column}" FROM csv_data WHERE "${column}" IS NOT NULL AND "${column}" != '' ORDER BY "${column}" LIMIT ?`, [limit]);
  const rows = resultToObjects(res);
  return rows.map(r => String(r[column]));
}

export async function getTableStats() {
  try {
    const db = await getDb();
    const resCount = db.exec('SELECT COUNT(*) as total FROM csv_data');
    const total = resCount.length > 0 ? resCount[0].values[0][0] : 0;
    
    const resDate = db.exec('SELECT MIN(dta_solicitacao) as min_date, MAX(dta_solicitacao) as max_date FROM csv_data WHERE dta_solicitacao IS NOT NULL');
    const minDate = resDate.length > 0 ? resDate[0].values[0][0] : null;
    const maxDate = resDate.length > 0 ? resDate[0].values[0][1] : null;
    
    return { total, minDate, maxDate };
  } catch {
    return { total: 0, minDate: null, maxDate: null };
  }
}

export async function exportFilteredCSV(selectedColumns: string[], conditions: FilterCondition[]): Promise<string> {
  const db = await getDb();
  const cols = selectedColumns.length
    ? selectedColumns.map(c => `"${c}"`).join(', ')
    : '*';
  const { sql: where, params } = buildWhereClause(conditions);
  const hasSpecificCols = selectedColumns.length > 0;
  const groupBy = hasSpecificCols ? `GROUP BY ${cols}` : '';
  const orderBy = hasSpecificCols ? 'ORDER BY MIN(id)' : 'ORDER BY id';
  const res = db.exec(`SELECT ${cols} FROM csv_data ${where} ${groupBy} ${orderBy}`, params);
  const rows = resultToObjects(res);

  if (!rows.length) return '';

  const headers = Object.keys(rows[0]);
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

// --- IndexedDB: Filters ---
export async function getSavedFilters(): Promise<SavedFilter[]> {
  const idb = await getIdb();
  if (!idb) return [];
  const filters = await idb.getAll('filters');
  return filters.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveFilterToFile(filter: SavedFilter): Promise<void> {
  filter.updatedAt = new Date().toISOString();
  const idb = await getIdb();
  if (!idb) return;
  await idb.put('filters', filter);
}

export async function deleteFilterFile(id: string): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  await idb.delete('filters', id);
}

export async function getFilterById(id: string): Promise<SavedFilter | null> {
  const idb = await getIdb();
  if (!idb) return null;
  return (await idb.get('filters', id)) || null;
}

// --- IndexedDB: Annotations ---
export async function getAnnotations(rowIds: number[], colIds: string[]): Promise<Record<string, string>> {
  const idb = await getIdb();
  if (!idb || !rowIds.length || !colIds.length) return {};
  
  const result: Record<string, string> = {};
  for (const rId of rowIds) {
    for (const cId of colIds) {
      const key = `${rId}:${cId}`;
      const val = await idb.get('annotations', key);
      if (val !== undefined) result[key] = val;
    }
  }
  return result;
}

export async function setAnnotation(rowId: number, colId: string, value: string): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  const key = `${rowId}:${colId}`;
  if (value === '') {
    await idb.delete('annotations', key);
  } else {
    await idb.put('annotations', value, key);
  }
}

// --- Pathologists ---
export async function getDistinctPatologists(): Promise<string[]> {
  const db = await getDb();
  try {
    const res = db.exec(`SELECT DISTINCT nom_patologista FROM csv_data
       WHERE nom_patologista IS NOT NULL AND nom_patologista != ''
       ORDER BY nom_patologista`);
    const rows = resultToObjects(res);
    return rows.map(r => String(r.nom_patologista));
  } catch {
    return [];
  }
}

export interface Pathologist {
  nome: string;
  telefone: string;
}

export async function getSavedPathologists(): Promise<Pathologist[]> {
  const idb = await getIdb();
  if (!idb) return [];
  const pats = await idb.getAll('pathologists');
  return pats;
}

export async function savePathologist(nome: string, telefone: string): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  await idb.put('pathologists', { nome, telefone });
}

export async function getPatologistaSummary(
  conditions: FilterCondition[],
  patologistaNome: string
): Promise<{ total: number; eventos: { nome_evento: string; count: number }[] }> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);

  const patCond = where
    ? `${where} AND "nom_patologista" = ?`
    : `WHERE "nom_patologista" = ?`;
  const allParams = [...params, patologistaNome];

  const resCount = db.exec(`SELECT COUNT(*) as total FROM csv_data ${patCond}`, allParams);
  const total = resCount.length > 0 ? resCount[0].values[0][0] : 0;

  const resEventos = db.exec(`SELECT nom_evento_fatur as nome_evento, COUNT(*) as count
     FROM csv_data ${patCond}
     AND nom_evento_fatur IS NOT NULL AND nom_evento_fatur != ''
     GROUP BY nom_evento_fatur
     ORDER BY count DESC`, allParams);
  const eventoRows = resultToObjects(resEventos);

  return {
    total: total as number ?? 0,
    eventos: eventoRows.map(r => ({ nome_evento: String(r.nome_evento), count: Number(r.count) })),
  };
}

export async function getPatologistaRows(
  conditions: FilterCondition[],
  selectedColumns: string[],
  patologistaNome: string
): Promise<{ columns: { name: string; label: string; type: string }[]; rows: Record<string, string>[] }> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);
  const patCond = where
    ? `${where} AND "nom_patologista" = ?`
    : `WHERE "nom_patologista" = ?`;
  const allParams = [...params, patologistaNome];

  const cols = selectedColumns.length ? selectedColumns : COLUMNS.map(c => c.name);
  const colsSql = cols.map(c => `"${c}"`).join(', ');

  const groupBy = `GROUP BY ${colsSql}`;
  const resRows = db.exec(`SELECT ${colsSql} FROM csv_data ${patCond} ${groupBy} ORDER BY MIN(id)`, allParams);
  const rows = resultToObjects(resRows);

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