import initSqlJs, { Database } from "sql.js";
import { openDB, IDBPDatabase } from "idb";

// --- Column definitions (fixed schema) ---
export interface ColumnDef {
  name: string;
  label: string;
  type: "text" | "number" | "date";
}

export const COLUMNS: ColumnDef[] = [
  { name: "cod_requisicao", label: "CodRequisicao", type: "text" },
  { name: "nom_paciente", label: "NomPaciente", type: "text" },
  { name: "dta_solicitacao", label: "DtaSolicitacao", type: "date" },
  { name: "dta_finalizacao", label: "DtaFinalizacao", type: "date" },
  { name: "dta_prevista", label: "DtaPrevista", type: "date" },
  { name: "dta_coleta", label: "DtaColeta", type: "date" },
  { name: "cod_exame", label: "CodExame", type: "text" },
  { name: "nom_exame", label: "NomExame", type: "text" },
  { name: "cod_evento", label: "CodEvento", type: "text" },
  { name: "nom_evento", label: "NomEvento", type: "text" },
  { name: "nom_evento_fatur", label: "NomEventoFatur", type: "text" },
  { name: "cod_medico", label: "CodMedico", type: "text" },
  { name: "id_convenio", label: "IdConvenio", type: "number" },
  { name: "nom_convenio", label: "NomConvenio", type: "text" },
  { name: "nom_fonte_pagadora", label: "NomFontePagadora", type: "text" },
  { name: "nom_local_origem", label: "NomLocalOrigem", type: "text" },
  { name: "nom_patologista", label: "NomPatologista", type: "text" },
  { name: "local_origem", label: "LocalOrigem", type: "text" },
  { name: "convenio", label: "Convenio", type: "text" },
  { name: "patologista", label: "Patologista", type: "text" },
  { name: "patologista_aux", label: "PatologistaAux", type: "text" },
  { name: "des_evento", label: "DesEvento", type: "text" },
  { name: "destaque", label: "Destaque", type: "text" },
  { name: "laudo_micro", label: "LaudoMicro", type: "text" },
  { name: "avaliacao_cito", label: "AvaliacaoCito", type: "text" },
  { name: "visualizacao", label: "Visualizado", type: "number" },
];

export const HEADER_MAP: Record<string, string> = {};
COLUMNS.forEach((c) => {
  HEADER_MAP[c.label.toLowerCase()] = c.name;
});

function normalizeDateString(raw: string): string {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}${m[4]}`;
  return raw;
}

// --- In-Memory SQLite Setup ---
let _dbPromise: Promise<Database> | null = null;

function createEmptyDb(SQL: any): Database {
  const colDefs = COLUMNS.map((c) => {
    const sqlType = c.type === "number" ? "REAL" : "TEXT";
    return `"${c.name}" ${sqlType}`;
  }).join(",\n  ");

  const db = new SQL.Database();
  db.run(`CREATE TABLE csv_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${colDefs}
  )`);

  const indexCols = [
    "nom_convenio",
    "nom_exame",
    "nom_paciente",
    "dta_solicitacao",
    "dta_coleta",
    "dta_finalizacao",
    "nom_fonte_pagadora",
    "nom_evento",
    "cod_exame",
    "cod_evento",
    "des_evento",
  ];
  for (const col of indexCols) {
    db.run(`CREATE INDEX idx_${col} ON csv_data("${col}")`);
  }
  return db;
}

function migrateDb(db: Database): void {
  const info = db.exec("PRAGMA table_info(csv_data)");
  const colNames = (info[0]?.values ?? []).map((r: any[]) => r[1] as string);
  const newCols = COLUMNS.filter((c) => !colNames.includes(c.name));
  for (const c of newCols) {
    const sqlType = c.type === "number" ? "REAL" : "TEXT";
    db.run(`ALTER TABLE csv_data ADD COLUMN "${c.name}" ${sqlType}`);
  }
}

export function getDb(): Promise<Database> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const wasmResponse = await fetch("/sql-wasm.wasm");
      if (!wasmResponse.ok) {
        throw new Error(
          `Failed to fetch sql-wasm.wasm: ${wasmResponse.statusText}`,
        );
      }
      const wasmBinary = await wasmResponse.arrayBuffer();
      const SQL = await initSqlJs({ wasmBinary });

      // Try to restore persisted database from IndexedDB
      const idb = await getIdb();
      if (idb) {
        const snapshot = (await idb.get("csv_database", "snapshot")) as
          | Uint8Array
          | undefined;
        if (snapshot) {
          const db = new SQL.Database(snapshot);
          migrateDb(db);
          return db;
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
  if (typeof window === "undefined") return null; // SSR safety
  if (!idbPromise) {
    idbPromise = openDB("csv-filter-pro", 5, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains("filters")) {
            db.createObjectStore("filters", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("annotations")) {
            db.createObjectStore("annotations");
          }
          if (!db.objectStoreNames.contains("pathologists")) {
            db.createObjectStore("pathologists", { keyPath: "nome" });
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("csv_database")) {
            db.createObjectStore("csv_database");
          }
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains("clinics")) {
            db.createObjectStore("clinics", { keyPath: "nome" });
          }
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains("bio_molecular_settings")) {
            db.createObjectStore("bio_molecular_settings");
          }
        }
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains("analises_clinicas_settings")) {
            db.createObjectStore("analises_clinicas_settings");
          }
        }
      },
    });
  }
  return idbPromise;
}

// --- CSV Import ---
export async function importCSV(
  headers: string[],
  rows: string[][],
  allowedColumns?: Set<string>,
): Promise<{ rowCount: number; merged: number; skipped: number }> {
  const db = await getDb();

  const colMapping: { csvIndex: number; dbCol: string; colDef: ColumnDef }[] =
    [];
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    const dbName = HEADER_MAP[key];
    if (dbName && (!allowedColumns || allowedColumns.has(dbName))) {
      const colDef = COLUMNS.find((c) => c.name === dbName)!;
      colMapping.push({ csvIndex: i, dbCol: dbName, colDef });
    }
  });

  if (colMapping.length === 0) {
    throw new Error("Nenhuma coluna do CSV corresponde ao schema esperado");
  }

  const dbCols = colMapping.map((m) => `"${m.dbCol}"`).join(", ");
  const placeholders = colMapping.map(() => "?").join(", ");

  // Check if cod_requisicao is in the mapped columns
  const codReqMapping = colMapping.find((m) => m.dbCol === "cod_requisicao");

  // Pre-load existing ids indexed by cod_requisicao (1-to-many: one codReq → many row ids)
  const existingMap = new Map<string, number[]>();
  if (codReqMapping) {
    const existingRes = db.exec(
      `SELECT id, "cod_requisicao" FROM csv_data WHERE "cod_requisicao" IS NOT NULL AND "cod_requisicao" != ''`
    );
    if (existingRes.length > 0) {
      const { values } = existingRes[0];
      for (const row of values) {
        const id = row[0] as number;
        const codReq = row[1];
        if (codReq != null && codReq !== "") {
          const key = String(codReq);
          const ids = existingMap.get(key);
          if (ids) ids.push(id);
          else existingMap.set(key, [id]);
        }
      }
    }
  }

  let imported = 0;
  let merged = 0;
  let skipped = 0;

  db.run("BEGIN TRANSACTION;");
  const insertStmt = db.prepare(
    `INSERT INTO csv_data (${dbCols}) VALUES (${placeholders})`,
  );

  // Pre-compute codReqIdx once
  const codReqIdx = codReqMapping ? colMapping.indexOf(codReqMapping) : -1;

  // Build SET clause for UPDATE (all columns except cod_requisicao)
  const updateCols = colMapping.filter((m) => m.dbCol !== "cod_requisicao");
  const updateSetClause = updateCols.map((m) => `"${m.dbCol}" = ?`).join(", ");

  for (const row of rows) {
    try {
      // Parse all values for this row
      const parsedValues = colMapping.map((m) => {
        const raw = (row[m.csvIndex] || "").trim();
        if (!raw) return null;
        if (m.colDef.type === "number") {
          const num = parseFloat(raw.replace(",", "."));
          return isNaN(num) ? null : num;
        }
        if (m.colDef.type === "date") return normalizeDateString(raw);
        return raw;
      });

      const codReqVal = codReqIdx >= 0 ? parsedValues[codReqIdx] : null;

      if (codReqVal != null && codReqVal !== "" && existingMap.has(String(codReqVal))) {
        // Merge: SET all columns (direct overwrite) for every matching row
        const ids = existingMap.get(String(codReqVal))!;
        const setValues = updateCols.map((m) => parsedValues[colMapping.indexOf(m)]);

        for (const id of ids) {
          db.run(
            `UPDATE csv_data SET ${updateSetClause} WHERE id = ?`,
            [...setValues, id] as (string | number | null)[],
          );
          merged++;
        }
      } else {
        // Insert new row
        insertStmt.run(parsedValues as (string | number | null)[]);
        imported++;
      }
    } catch (e) {
      skipped++;
    }
  }

  insertStmt.free();
  db.run("COMMIT;");

  // Persist snapshot to IndexedDB so data survives page navigation
  const idb = await getIdb();
  if (idb) {
    const snapshot = db.export();
    await idb.put("csv_database", snapshot, "snapshot");
  }

  return { rowCount: imported, merged, skipped };
}

// --- Visualizacao CSV Import (secondary CSV enrichment) ---
export async function importVisualizacaoCSV(
  headers: string[],
  rows: string[][],
): Promise<{ updated: number; skipped: number }> {
  const db = await getDb();

  const codReqIdx = headers.findIndex(
    (h) => HEADER_MAP[h.trim().toLowerCase()] === "cod_requisicao",
  );
  const vizIdx = headers.findIndex(
    (h) => HEADER_MAP[h.trim().toLowerCase()] === "visualizacao",
  );

  if (codReqIdx < 0 || vizIdx < 0) {
    throw new Error(
      "CSV de visualização precisa ter colunas CodRequisicao e Visualizacao",
    );
  }

  let updated = 0;
  let skipped = 0;

  db.run("BEGIN TRANSACTION;");
  const stmt = db.prepare(
    `UPDATE csv_data SET "visualizacao" = ? WHERE "cod_requisicao" = ?`,
  );

  for (const row of rows) {
    try {
      const codReq = (row[codReqIdx] || "").trim();
      const viz = (row[vizIdx] || "").trim();
      if (!codReq) {
        skipped++;
        continue;
      }
      stmt.run([viz || null, codReq]);
      if (db.getRowsModified() > 0) updated++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  stmt.free();
  db.run("COMMIT;");

  const idb = await getIdb();
  if (idb) {
    const snapshot = db.export();
    await idb.put("csv_database", snapshot, "snapshot");
  }

  return { updated, skipped };
}

// --- Query ---
export interface FilterCondition {
  column: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "between"
    | "in"
    | "not_in"
    | "is_null"
    | "is_not_null"
    | "date_after"
    | "date_before"
    | "date_between"
    | "is_today"
    | "is_tomorrow"
    | "is_future"
    | "is_past"
    | "is_today_or_tomorrow"
    | "is_future_or_today"
    | "is_past_or_today";
  value: string | number;
  value2?: string | number;
  orGroup?: string;
}

export interface ColorRule {
  id: string;
  name: string;
  targetType: "row" | "cell";
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

export function deriveColumnsFromFilters(filters: SavedFilter[]): Set<string> {
  const validNames = new Set(COLUMNS.map((c) => c.name));
  const needed = new Set<string>();
  for (const f of filters) {
    f.selectedColumns.forEach((c) => {
      if (validNames.has(c)) needed.add(c);
    });
    f.conditions.forEach((c) => {
      if (validNames.has(c.column)) needed.add(c.column);
    });
    f.colorRules?.forEach((r) => {
      if (validNames.has(r.conditionColumn)) needed.add(r.conditionColumn);
      if (r.targetColumn && validNames.has(r.targetColumn))
        needed.add(r.targetColumn);
    });
    f.whatsappLinhasColumns?.forEach((c) => {
      if (validNames.has(c)) needed.add(c);
    });
  }
  return needed;
}

function conditionToSQL(c: FilterCondition): { clause: string; params: any[] } {
  const col = `"${c.column}"`;
  const params: any[] = [];
  let clause = "";

  switch (c.operator) {
    case "equals":
      if (c.value === "" || c.value == null) {
        clause = `(${col} IS NULL OR ${col} = '')`;
      } else {
        clause = `${col} = ?`;
        params.push(c.value);
      }
      break;
    case "not_equals":
      if (c.value === "" || c.value == null) {
        clause = `(${col} IS NOT NULL AND ${col} != '')`;
      } else {
        clause = `${col} != ?`;
        params.push(c.value);
      }
      break;
    case "contains":
      clause = `${col} LIKE ?`;
      params.push(`%${c.value}%`);
      break;
    case "not_contains":
      clause = `${col} NOT LIKE ?`;
      params.push(`%${c.value}%`);
      break;
    case "gt":
      clause = `CAST(${col} AS REAL) > ?`;
      params.push(Number(c.value));
      break;
    case "gte":
      clause = `CAST(${col} AS REAL) >= ?`;
      params.push(Number(c.value));
      break;
    case "lt":
      clause = `CAST(${col} AS REAL) < ?`;
      params.push(Number(c.value));
      break;
    case "lte":
      clause = `CAST(${col} AS REAL) <= ?`;
      params.push(Number(c.value));
      break;
    case "between":
      clause = `CAST(${col} AS REAL) BETWEEN ? AND ?`;
      params.push(Number(c.value), Number(c.value2));
      break;
    case "in": {
      const vals = String(c.value).split(",").map((v) => v.trim());
      clause = `${col} IN (${vals.map(() => "?").join(",")})`;
      params.push(...vals);
      break;
    }
    case "not_in": {
      const vals = String(c.value).split(",").map((v) => v.trim());
      clause = `${col} NOT IN (${vals.map(() => "?").join(",")})`;
      params.push(...vals);
      break;
    }
    case "is_null":
      clause = `(${col} IS NULL OR ${col} = '')`;
      break;
    case "is_not_null":
      clause = `(${col} IS NOT NULL AND ${col} != '')`;
      break;
    case "date_after":
      clause = `${col} >= ?`;
      params.push(c.value);
      break;
    case "date_before":
      clause = `${col} <= ?`;
      params.push(c.value);
      break;
    case "date_between":
      clause = `${col} BETWEEN ? AND ?`;
      params.push(c.value, c.value2);
      break;
    case "is_today":
      clause = `(${col} IS NOT NULL AND DATE(${col}) = date('now', 'localtime'))`;
      break;
    case "is_tomorrow":
      clause = `(${col} IS NOT NULL AND DATE(${col}) = date('now', 'localtime', '+1 day'))`;
      break;
    case "is_today_or_tomorrow":
      clause = `(${col} IS NOT NULL AND DATE(${col}) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+1 day'))`;
      break;
    case "is_future":
      clause = `(${col} IS NOT NULL AND DATE(${col}) > date('now', 'localtime'))`;
      break;
    case "is_future_or_today":
      clause = `(${col} IS NOT NULL AND DATE(${col}) >= date('now', 'localtime'))`;
      break;
    case "is_past":
      clause = `(${col} IS NOT NULL AND DATE(${col}) < date('now', 'localtime'))`;
      break;
    case "is_past_or_today":
      clause = `(${col} IS NOT NULL AND DATE(${col}) <= date('now', 'localtime'))`;
      break;
  }

  return { clause, params };
}

function buildWhereClause(conditions: FilterCondition[]): {
  sql: string;
  params: any[];
} {
  if (!conditions.length) return { sql: "", params: [] };

  const andClauses: string[] = [];
  const params: any[] = [];

  // ungrouped conditions → straight AND
  for (const c of conditions.filter((c) => !c.orGroup)) {
    const r = conditionToSQL(c);
    andClauses.push(r.clause);
    params.push(...r.params);
  }

  // OR groups — each group becomes (c1 OR c2 ...) in AND chain
  const groupClauses = new Map<string, string[]>();
  const groupParams = new Map<string, any[]>();
  for (const c of conditions.filter((c) => c.orGroup)) {
    const r = conditionToSQL(c);
    const g = c.orGroup!;
    if (!groupClauses.has(g)) {
      groupClauses.set(g, []);
      groupParams.set(g, []);
    }
    groupClauses.get(g)!.push(r.clause);
    groupParams.get(g)!.push(...r.params);
  }
  groupClauses.forEach((clauses, g) => {
    andClauses.push(`(${clauses.join(" OR ")})`);
    params.push(...groupParams.get(g)!);
  });

  return { sql: `WHERE ${andClauses.join(" AND ")}`, params };
}

export async function queryFiltered(
  selectedColumns: string[],
  conditions: FilterCondition[],
  page = 1,
  pageSize = 50,
  sortColumn?: string,
  sortDir: "asc" | "desc" = "asc",
) {
  const db = await getDb();
  const hasSpecificCols = selectedColumns.length > 0;
  const cols = hasSpecificCols
    ? selectedColumns.map((c) => `"${c}"`).join(", ")
    : "*";
  const rowIdExpr = hasSpecificCols
    ? ", MIN(id) as _row_id"
    : ", id as _row_id";
  const { sql: where, params } = buildWhereClause(conditions);
  const groupBy = hasSpecificCols ? `GROUP BY ${cols}` : "";
  const orderBy = sortColumn
    ? `ORDER BY "${sortColumn}" ${sortDir}`
    : hasSpecificCols
      ? "ORDER BY MIN(id)"
      : "ORDER BY id";
  const offset = (page - 1) * pageSize;

  const countSql = hasSpecificCols
    ? `SELECT COUNT(*) as total FROM (SELECT 1 FROM csv_data ${where} ${groupBy})`
    : `SELECT COUNT(*) as total FROM csv_data ${where}`;

  const resTotal = db.exec(countSql, params);
  const total = resTotal.length > 0 ? resTotal[0].values[0][0] : 0;

  const resRows = db.exec(
    `SELECT ${cols}${rowIdExpr} FROM csv_data ${where} ${groupBy} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const rows = resultToObjects(resRows);

  return { rows, total };
}

export async function getDistinctValues(
  column: string,
  limit = 200,
): Promise<string[]> {
  const db = await getDb();
  const res = db.exec(
    `SELECT DISTINCT "${column}" FROM csv_data WHERE "${column}" IS NOT NULL AND "${column}" != '' ORDER BY "${column}" LIMIT ?`,
    [limit],
  );
  const rows = resultToObjects(res);
  return rows.map((r) => String(r[column]));
}

export async function getTableStats() {
  try {
    const db = await getDb();
    const resCount = db.exec("SELECT COUNT(*) as total FROM csv_data");
    const total = resCount.length > 0 ? resCount[0].values[0][0] : 0;

    const resDate = db.exec(
      "SELECT MIN(dta_solicitacao) as min_date, MAX(dta_solicitacao) as max_date FROM csv_data WHERE dta_solicitacao IS NOT NULL",
    );
    const minDate = resDate.length > 0 ? resDate[0].values[0][0] : null;
    const maxDate = resDate.length > 0 ? resDate[0].values[0][1] : null;

    return { total, minDate, maxDate };
  } catch {
    return { total: 0, minDate: null, maxDate: null };
  }
}

export async function exportFilteredCSV(
  selectedColumns: string[],
  conditions: FilterCondition[],
): Promise<string> {
  const db = await getDb();
  const cols = selectedColumns.length
    ? selectedColumns.map((c) => `"${c}"`).join(", ")
    : "*";
  const { sql: where, params } = buildWhereClause(conditions);
  const hasSpecificCols = selectedColumns.length > 0;
  const groupBy = hasSpecificCols ? `GROUP BY ${cols}` : "";
  const orderBy = hasSpecificCols ? "ORDER BY MIN(id)" : "ORDER BY id";
  const res = db.exec(
    `SELECT ${cols} FROM csv_data ${where} ${groupBy} ${orderBy}`,
    params,
  );
  const rows = resultToObjects(res);

  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const headerLabels = headers.map((h) => {
    const col = COLUMNS.find((c) => c.name === h);
    return col ? col.label : h;
  });

  const lines = [headerLabels.join(";")];
  for (const row of rows) {
    const vals = headers.map((h) => {
      const v = String(row[h] ?? "");
      return v.includes(";") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    });
    lines.push(vals.join(";"));
  }
  return lines.join("\n");
}

// --- IndexedDB: Filters ---
const SEED_KEY = "csv-filter-defaults-seeded-v3";

// --- Reset All Data ---
export async function resetAllData(): Promise<void> {
  if (typeof window === "undefined") return;

  // Clear in-memory SQL db
  try {
    const db = await getDb();
    db.run("DELETE FROM csv_data");
  } catch {
    // ignore if db not initialized
  }

  // Reset db promise so next getDb() creates a fresh empty db
  _dbPromise = null;

  const idb = await getIdb();
  if (idb) {
    // Clear CSV snapshot
    await idb.delete("csv_database", "snapshot");
    // Clear all filters
    await idb.clear("filters");
    // Clear all annotations
    await idb.clear("annotations");
  }

  // Remove seed keys so defaults get re-seeded
  localStorage.removeItem(SEED_KEY);
}

async function seedDefaultFilters(idb: IDBPDatabase): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_KEY)) return;

  try {
    const res = await fetch("/default-filters.json");
    if (!res.ok) return;
    const defaults: SavedFilter[] = await res.json();
    const tx = idb.transaction("filters", "readwrite");
    await Promise.all(defaults.map((f) => tx.store.put(f)));
    await tx.done;
    localStorage.setItem(SEED_KEY, "1");
  } catch {
    // silently ignore — default filters are optional
  }
}

export async function getSavedFilters(): Promise<SavedFilter[]> {
  const idb = await getIdb();
  if (!idb) return [];
  await seedDefaultFilters(idb);
  const filters = await idb.getAll("filters");
  return filters.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveFilterToFile(filter: SavedFilter): Promise<void> {
  filter.updatedAt = new Date().toISOString();
  const idb = await getIdb();
  if (!idb) return;
  await idb.put("filters", filter);
}

export async function deleteFilterFile(id: string): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  await idb.delete("filters", id);
}

export async function deleteDefaultFilters(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/default-filters.json");
    if (!res.ok) return;
    const defaults: SavedFilter[] = await res.json();
    const idb = await getIdb();
    if (!idb) return;
    await Promise.all(defaults.map((f) => idb.delete("filters", f.id)));
    localStorage.setItem(SEED_KEY, "1");
  } catch {
    // silently ignore
  }
}

export async function getFilterById(id: string): Promise<SavedFilter | null> {
  const idb = await getIdb();
  if (!idb) return null;
  return (await idb.get("filters", id)) || null;
}

// --- IndexedDB: Annotations ---
export async function getAnnotations(
  rowIds: number[],
  colIds: string[],
): Promise<Record<string, string>> {
  const idb = await getIdb();
  if (!idb || !rowIds.length || !colIds.length) return {};

  const result: Record<string, string> = {};
  for (const rId of rowIds) {
    for (const cId of colIds) {
      const key = `${rId}:${cId}`;
      const val = await idb.get("annotations", key);
      if (val !== undefined) result[key] = val;
    }
  }
  return result;
}

export async function setAnnotation(
  rowId: number,
  colId: string,
  value: string,
): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  const key = `${rowId}:${colId}`;
  if (value === "") {
    await idb.delete("annotations", key);
  } else {
    await idb.put("annotations", value, key);
  }
}

// --- IndexedDB: Numbers seed (numeros.json — gitignored, not committed) ---
interface NumerosSeed {
  pathologists?: Pathologist[];
  clinics?: Clinic[];
  biomolecular?: string;
  analises_clinicas?: string;
}

let _numerosSeedCache: NumerosSeed | null | undefined = undefined;

async function fetchNumerosSeed(): Promise<NumerosSeed> {
  if (_numerosSeedCache !== undefined) return _numerosSeedCache ?? {};
  try {
    const res = await fetch("/api/numeros");
    if (!res.ok) { _numerosSeedCache = null; return {}; }
    _numerosSeedCache = await res.json();
    return _numerosSeedCache ?? {};
  } catch {
    _numerosSeedCache = null;
    return {};
  }
}

// --- IndexedDB: Pathologists seed ---
const SEED_PATHOLOGISTS_KEY = "csv-filter-pathologists-seeded";

async function seedDefaultPathologists(idb: IDBPDatabase): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_PATHOLOGISTS_KEY)) return;
  try {
    const seed = await fetchNumerosSeed();
    const defaults = seed.pathologists ?? [];
    if (!defaults.length) return;
    const tx = idb.transaction("pathologists", "readwrite");
    await Promise.all(defaults.map((p) => tx.store.put(p)));
    await tx.done;
    localStorage.setItem(SEED_PATHOLOGISTS_KEY, "1");
  } catch {
    // silently ignore
  }
}

// --- IndexedDB: Clinics seed ---
const SEED_CLINICS_KEY = "csv-filter-clinics-seeded";

async function seedDefaultClinics(idb: IDBPDatabase): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_CLINICS_KEY)) return;
  try {
    const seed = await fetchNumerosSeed();
    const defaults = seed.clinics ?? [];
    if (!defaults.length) return;
    const tx = idb.transaction("clinics", "readwrite");
    await Promise.all(defaults.map((c) => tx.store.put(c)));
    await tx.done;
    localStorage.setItem(SEED_CLINICS_KEY, "1");
  } catch {
    // silently ignore
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
    return rows.map((r) => String(r.nom_patologista));
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
  await seedDefaultPathologists(idb);
  return idb.getAll("pathologists");
}

export async function savePathologist(
  nome: string,
  telefone: string,
): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  await idb.put("pathologists", { nome, telefone });
}

export async function getPatologistaSummary(
  conditions: FilterCondition[],
  patologistaNome: string,
): Promise<{
  total: number;
  eventos: { nome_evento: string; count: number }[];
}> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);

  const patCond = where
    ? `${where} AND "nom_patologista" = ?`
    : `WHERE "nom_patologista" = ?`;
  const allParams = [...params, patologistaNome];

  const resCount = db.exec(
    `SELECT COUNT(*) as total FROM csv_data ${patCond}`,
    allParams,
  );
  const total = resCount.length > 0 ? resCount[0].values[0][0] : 0;

  const resEventos = db.exec(
    `SELECT nom_evento_fatur as nome_evento, COUNT(*) as count
     FROM csv_data ${patCond}
     AND nom_evento_fatur IS NOT NULL AND nom_evento_fatur != ''
     GROUP BY nom_evento_fatur
     ORDER BY count DESC`,
    allParams,
  );
  const eventoRows = resultToObjects(resEventos);

  return {
    total: (total as number) ?? 0,
    eventos: eventoRows.map((r) => ({
      nome_evento: String(r.nome_evento),
      count: Number(r.count),
    })),
  };
}

export async function getPatologistaRows(
  conditions: FilterCondition[],
  selectedColumns: string[],
  patologistaNome: string,
): Promise<{
  columns: { name: string; label: string; type: string }[];
  rows: Record<string, string>[];
}> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);
  const patCond = where
    ? `${where} AND "nom_patologista" = ?`
    : `WHERE "nom_patologista" = ?`;
  const allParams = [...params, patologistaNome];

  const cols = selectedColumns.length
    ? selectedColumns
    : COLUMNS.map((c) => c.name);
  const colsSql = cols.map((c) => `"${c}"`).join(", ");

  const groupBy = `GROUP BY ${colsSql}`;
  const resRows = db.exec(
    `SELECT ${colsSql} FROM csv_data ${patCond} ${groupBy} ORDER BY MIN(id)`,
    allParams,
  );
  const rows = resultToObjects(resRows);

  const columnDefs = cols.map((name) => {
    const def = COLUMNS.find((c) => c.name === name);
    return { name, label: def?.label ?? name, type: def?.type ?? "text" };
  });

  return {
    columns: columnDefs,
    rows: rows.map((r) => {
      const obj: Record<string, string> = {};
      for (const col of cols) obj[col] = String(r[col] ?? "");
      return obj;
    }),
  };
}

// --- Clinics ---
export interface Clinic {
  nome: string;
  telefone: string;
}

export async function getDistinctClinics(): Promise<string[]> {
  const db = await getDb();
  try {
    const res = db.exec(`SELECT DISTINCT nom_local_origem FROM csv_data
       WHERE nom_local_origem IS NOT NULL AND nom_local_origem != ''
       ORDER BY nom_local_origem`);
    const rows = resultToObjects(res);
    return rows.map((r) => String(r.nom_local_origem));
  } catch {
    return [];
  }
}

export async function getSavedClinics(): Promise<Clinic[]> {
  const idb = await getIdb();
  if (!idb) return [];
  await seedDefaultClinics(idb);
  return idb.getAll("clinics");
}

export async function saveClinic(
  nome: string,
  telefone: string,
): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  await idb.put("clinics", { nome, telefone });
}

export async function getClinicaSummary(
  conditions: FilterCondition[],
  clinicaNome: string,
): Promise<{
  total: number;
  eventos: { nome_evento: string; count: number }[];
}> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);
  const cond = where
    ? `${where} AND "nom_local_origem" = ?`
    : `WHERE "nom_local_origem" = ?`;
  const allParams = [...params, clinicaNome];

  const resCount = db.exec(
    `SELECT COUNT(*) as total FROM csv_data ${cond}`,
    allParams,
  );
  const total = resCount.length > 0 ? resCount[0].values[0][0] : 0;

  const resEventos = db.exec(
    `SELECT nom_evento_fatur as nome_evento, COUNT(*) as count
     FROM csv_data ${cond}
     AND nom_evento_fatur IS NOT NULL AND nom_evento_fatur != ''
     GROUP BY nom_evento_fatur
     ORDER BY count DESC`,
    allParams,
  );
  const eventoRows = resultToObjects(resEventos);

  return {
    total: (total as number) ?? 0,
    eventos: eventoRows.map((r) => ({
      nome_evento: String(r.nome_evento),
      count: Number(r.count),
    })),
  };
}

export async function getClinicaRows(
  conditions: FilterCondition[],
  selectedColumns: string[],
  clinicaNome: string,
): Promise<{
  columns: { name: string; label: string; type: string }[];
  rows: Record<string, string>[];
}> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);
  const cond = where
    ? `${where} AND "nom_local_origem" = ?`
    : `WHERE "nom_local_origem" = ?`;
  const allParams = [...params, clinicaNome];

  const cols = selectedColumns.length
    ? selectedColumns
    : COLUMNS.map((c) => c.name);
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  const groupBy = `GROUP BY ${colsSql}`;
  const resRows = db.exec(
    `SELECT ${colsSql} FROM csv_data ${cond} ${groupBy} ORDER BY MIN(id)`,
    allParams,
  );
  const rows = resultToObjects(resRows);

  const columnDefs = cols.map((name) => {
    const def = COLUMNS.find((c) => c.name === name);
    return { name, label: def?.label ?? name, type: def?.type ?? "text" };
  });

  return {
    columns: columnDefs,
    rows: rows.map((r) => {
      const obj: Record<string, string> = {};
      for (const col of cols) obj[col] = String(r[col] ?? "");
      return obj;
    }),
  };
}


// --- Biologia Molecular ---
const SEED_BIOMOLECULAR_KEY = "csv-filter-biomolecular-seeded";

async function seedDefaultBioMolecular(idb: IDBPDatabase): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_BIOMOLECULAR_KEY)) return;
  try {
    const seed = await fetchNumerosSeed();
    const telefone = seed.biomolecular ?? "";
    if (!telefone) return;
    await idb.put("bio_molecular_settings", telefone, "telefone");
    localStorage.setItem(SEED_BIOMOLECULAR_KEY, "1");
  } catch {
    // silently ignore
  }
}

export async function getSavedBioMolecularPhone(): Promise<string> {
  const idb = await getIdb();
  if (!idb) return "";
  await seedDefaultBioMolecular(idb);
  const val = await idb.get("bio_molecular_settings", "telefone");
  return (val as string) ?? "";
}

export async function saveBioMolecularPhone(telefone: string): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  await idb.put("bio_molecular_settings", telefone, "telefone");
}

// --- Análises Clínicas ---
const SEED_ANALISES_KEY = "csv-filter-analises-seeded";

async function seedDefaultAnalisesClinicas(idb: IDBPDatabase): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_ANALISES_KEY)) return;
  try {
    const seed = await fetchNumerosSeed();
    const telefone = seed.analises_clinicas ?? "";
    if (!telefone) return;
    await idb.put("analises_clinicas_settings", telefone, "telefone");
    localStorage.setItem(SEED_ANALISES_KEY, "1");
  } catch {
    // silently ignore
  }
}

export async function getSavedAnalisesClinicasPhone(): Promise<string> {
  const idb = await getIdb();
  if (!idb) return "";
  await seedDefaultAnalisesClinicas(idb);
  return (await idb.get("analises_clinicas_settings", "telefone") as string) ?? "";
}

export async function saveAnalisesClinicasPhone(telefone: string): Promise<void> {
  const idb = await getIdb();
  if (!idb) return;
  await idb.put("analises_clinicas_settings", telefone, "telefone");
}

export async function getBioMolecularSummary(
  conditions: FilterCondition[],
): Promise<{
  total: number;
  eventos: { nome_evento: string; count: number }[];
}> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);

  const resCount = db.exec(
    `SELECT COUNT(*) as total FROM csv_data ${where}`,
    params,
  );
  const total = resCount.length > 0 ? resCount[0].values[0][0] : 0;

  const eventWhere = where
    ? `${where} AND nom_evento_fatur IS NOT NULL AND nom_evento_fatur != ''`
    : `WHERE nom_evento_fatur IS NOT NULL AND nom_evento_fatur != ''`;

  const resEventos = db.exec(
    `SELECT nom_evento_fatur as nome_evento, COUNT(*) as count
     FROM csv_data ${eventWhere}
     GROUP BY nom_evento_fatur
     ORDER BY count DESC`,
    params,
  );
  const eventoRows = resultToObjects(resEventos);

  return {
    total: (total as number) ?? 0,
    eventos: eventoRows.map((r) => ({
      nome_evento: String(r.nome_evento),
      count: Number(r.count),
    })),
  };
}

export async function getBioMolecularRows(
  conditions: FilterCondition[],
  selectedColumns: string[],
): Promise<{
  columns: { name: string; label: string; type: string }[];
  rows: Record<string, string>[];
}> {
  const db = await getDb();
  const { sql: where, params } = buildWhereClause(conditions);

  const cols = selectedColumns.length
    ? selectedColumns
    : COLUMNS.map((c) => c.name);
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  const groupBy = `GROUP BY ${colsSql}`;
  const resRows = db.exec(
    `SELECT ${colsSql} FROM csv_data ${where} ${groupBy} ORDER BY MIN(id)`,
    params,
  );
  const bioRows = resultToObjects(resRows);

  const bioColumnDefs = cols.map((name) => {
    const def = COLUMNS.find((c) => c.name === name);
    return { name, label: def?.label ?? name, type: def?.type ?? "text" };
  });

  return {
    columns: bioColumnDefs,
    rows: bioRows.map((r) => {
      const obj: Record<string, string> = {};
      for (const col of cols) obj[col] = String(r[col] ?? "");
      return obj;
    }),
  };
}
