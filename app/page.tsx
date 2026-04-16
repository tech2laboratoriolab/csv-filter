"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTrack } from "@/lib/useTrack";
import Papa from "papaparse";
import type {
  ColorRule,
  FormulaColumn,
  AnnotationColumn,
  LookupColumn,
  TemplateColumn,
} from "@/lib/clientDb";
import DataTable from "@/app/components/DataTable";
import {
  importCSV,
  importVisualizacaoCSV,
  importPatologiaMolecularCSV,
  getTableStats,
  getSavedFilters,
  getDistinctValues,
  queryFiltered,
  exportFilteredCSV,
  saveFilterToFile,
  deleteFilterFile,
  deleteDefaultFilters,
  getAnnotations,
  setAnnotation,
  evaluateLookupColumns,
  deriveColumnsFromFilters,
  resetAllData,
  COLUMNS,
  HEADER_MAP,
  ColumnDef,
  FilterCondition,
  SavedFilter,
} from "@/lib/clientDb";

const SELECT_COLUMNS = new Set<string>();

const OPS_TEXT = [
  { v: "equals", l: "Igual" },
  { v: "not_equals", l: "≠ Diferente" },
  { v: "contains", l: "Contém" },
  { v: "not_contains", l: "Não contém" },
  { v: "in", l: "Em (lista)" },
];
const OPS_NUM = [
  { v: "equals", l: "= Igual" },
  { v: "not_equals", l: "≠ Diferente" },
  { v: "gt", l: "> Maior" },
  { v: "gte", l: "≥ Maior ou igual" },
  { v: "lt", l: "< Menor" },
  { v: "lte", l: "≤ Menor ou igual" },
  { v: "between", l: "Entre" },
];
const OPS_DATE = [
  { v: "equals", l: "Igual" },
  { v: "date_after", l: "Após" },
  { v: "date_before", l: "Antes" },
  { v: "date_between", l: "Entre" },
];

export default function Home() {
  const { track } = useTrack();
  const [columns, setColumns] = useState<ColumnDef[]>(COLUMNS);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [templateColumns, setTemplateColumns] = useState<TemplateColumn[]>([]);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [colSearch, setColSearch] = useState("");
  const [colorRules, setColorRules] = useState<ColorRule[]>([]);
  const [formulaColumns, setFormulaColumns] = useState<FormulaColumn[]>([]);
  const [formulaValues, setFormulaValues] = useState<string[][]>([]);
  const [lookupColumns, setLookupColumns] = useState<LookupColumn[]>([]);
  const [lookupValues, setLookupValues] = useState<string[][]>([]);
  const [annotationColumns, setAnnotationColumns] = useState<
    AnnotationColumn[]
  >([]);
  const [annotationValues, setAnnotationValues] = useState<
    Record<string, string>
  >({});
  const [dragging, setDragging] = useState(false);
  const [distinctValues, setDistinctValues] = useState<
    Record<string, string[]>
  >({});
  const fetchedCols = useRef<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const filterFileRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 50;

  // Init: load stats and saved filters
  useEffect(() => {
    const init = async () => {
      try {
        const stats = await getTableStats();
        if (stats.total && Number(stats.total) > 0) {
          setRowCount(Number(stats.total));
          setMinDate(stats.minDate ? String(stats.minDate) : "");
          setMaxDate(stats.maxDate ? String(stats.maxDate) : "");
          const allCols = COLUMNS.map((c: ColumnDef) => c.name);
          setSelectedCols(allCols);
          fetchData(allCols, [], 1);
        }

        const filters = await getSavedFilters();
        setSavedFilters(filters);
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  // Fetch distinct values for SELECT_COLUMNS when those columns appear in conditions
  useEffect(() => {
    const needed = Array.from(new Set(conditions.map((c) => c.column))).filter(
      (col) => SELECT_COLUMNS.has(col) && !fetchedCols.current.has(col),
    );
    for (const col of needed) {
      fetchedCols.current.add(col);
      getDistinctValues(col)
        .then((values) => {
          if (values) setDistinctValues((prev) => ({ ...prev, [col]: values }));
        })
        .catch(() => fetchedCols.current.delete(col));
    }
  }, [conditions]);

  // Recompute formula values when rows/formulaColumns/columns change
  useEffect(() => {
    if (!formulaColumns.length || !rows.length || !columns.length) {
      setFormulaValues([]);
      return;
    }
    const colNames = columns.map((c) => c.name);
    import("@/lib/formulaEngine")
      .then((m) => m.evaluateFormulasAsync(rows, formulaColumns, colNames))
      .then((vals) => setFormulaValues(vals))
      .catch(() => setFormulaValues([]));
  }, [rows, formulaColumns, columns]);

  // Evaluate lookup columns when rows/lookupColumns change
  useEffect(() => {
    if (!lookupColumns.length || !rows.length) { setLookupValues([]); return; }
    evaluateLookupColumns(rows, lookupColumns).then(setLookupValues).catch(() => setLookupValues([]));
  }, [rows, lookupColumns]);

  // Fetch annotation values when rows/annotationColumns change
  useEffect(() => {
    if (!annotationColumns.length || !rows.length) {
      setAnnotationValues({});
      return;
    }
    const rowIds = rows.map((r) => r._row_id as number);
    const colIds = annotationColumns.map((a) => a.id);
    getAnnotations(rowIds, colIds)
      .then((annotations) => {
        setAnnotationValues(annotations);
      })
      .catch(() => {});
  }, [rows, annotationColumns]);

  const fetchData = useCallback(
    async (
      cols?: string[],
      conds?: FilterCondition[],
      pg?: number,
      sCol?: string,
      sDir?: "asc" | "desc",
    ) => {
      setLoading(true);
      try {
        const result = await queryFiltered(
          cols ?? selectedCols,
          conds ?? conditions,
          pg ?? page,
          PAGE_SIZE,
          sCol ?? sortCol,
          sDir ?? sortDir,
        );
        setRows(result.rows || []);
        setTotal(Number(result.total) || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [selectedCols, conditions, page, sortCol, sortDir],
  );

  // Upload
  const handleUpload = useCallback(
    (file: File) => {
      setUploading(true);
      setProgress(0);
      const iv = setInterval(
        () => setProgress((p) => Math.min(p + 3, 90)),
        150,
      );

      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: async (results) => {
          clearInterval(iv);
          setProgress(95);
          if (results.data.length < 2) {
            setUploading(false);
            alert("CSV precisa ter cabeçalho + dados");
            return;
          }

          try {
            const headers = results.data[0];
            const dataRows = results.data.slice(1);

            const mappedCols = headers
              .map((h) => HEADER_MAP[h.trim().toLowerCase()])
              .filter(Boolean);
            const isVisualizacaoCSV =
              mappedCols.includes("visualizacao") &&
              mappedCols.every((c) =>
                ["cod_requisicao", "visualizacao"].includes(c),
              );

            const isPatologiaMolecularCSV =
              mappedCols.includes("conclusao") &&
              mappedCols.includes("cod_requisicao");

            if (isVisualizacaoCSV) {
              const { updated, skipped } = await importVisualizacaoCSV(
                headers,
                dataRows,
              );
              setProgress(100);
              alert(
                `${updated} registro(s) atualizados com visualização${skipped > 0 ? ` (${skipped} não encontrados)` : ""}`,
              );
            } else if (isPatologiaMolecularCSV) {
              const { updated, skipped } = await importPatologiaMolecularCSV(
                headers,
                dataRows,
              );
              setProgress(100);
              alert(
                `${updated} registro(s) atualizados com dados moleculares${skipped > 0 ? ` (${skipped} não encontrados)` : ""}`,
              );
            } else {
              const allFilters = await getSavedFilters();
              const allowedCols =
                allFilters.length > 0
                  ? deriveColumnsFromFilters(allFilters)
                  : new Set(COLUMNS.map((c) => c.name));

              const { rowCount, merged, skipped } = await importCSV(
                headers,
                dataRows,
                allowedCols,
              );

              setSavedFilters(allFilters);
              setProgress(100);

              const stats = await getTableStats();
              setRowCount(Number(stats.total) || 0);
              setMinDate(stats.minDate ? String(stats.minDate) : "");
              setMaxDate(stats.maxDate ? String(stats.maxDate) : "");

              const colsToShow = Array.from(allowedCols);
              setSelectedCols(colsToShow);
              setConditions([]);
              setPage(1);
              fetchData(colsToShow, [], 1);

              track("csv_upload", { rows: rowCount, merged, skipped });
              let msg = "";
              if (rowCount > 0) msg += `${rowCount} linha(s) inserida(s). `;
              if (merged > 0) msg += `${merged} linha(s) mesclada(s). `;
              if (skipped > 0) msg += `${skipped} ignorada(s). `;
              if (msg) alert(msg.trim());
            }
          } catch (e: any) {
            alert("Erro no upload: " + e.message);
          } finally {
            setUploading(false);
          }
        },
        error: (err) => {
          clearInterval(iv);
          alert("Erro ao ler arquivo: " + err.message);
          setUploading(false);
        },
      });
    },
    [fetchData],
  );

  // Column toggle
  const toggleCol = (name: string) => {
    setSelectedCols((p) =>
      p.includes(name) ? p.filter((c) => c !== name) : [...p, name],
    );
  };

  const selectAllCols = () => setSelectedCols(columns.map((c) => c.name));
  const deselectAllCols = () => setSelectedCols([]);

  // Filters
  const addCondition = () => {
    if (!columns.length) return;
    setConditions((p) => [
      ...p,
      { column: columns[0].name, operator: "equals", value: "" },
    ]);
  };

  const updateCond = (i: number, field: string, val: string) => {
    setConditions((p) => {
      const n = [...p];
      (n[i] as any)[field] = val;
      if (field === "column") {
        n[i].operator = "equals";
        n[i].value = "";
      }
      return n;
    });
  };

  const removeCond = (i: number) =>
    setConditions((p) => p.filter((_, j) => j !== i));

  const applyFilters = () => {
    track("filter_applied", { conditions: conditions.length });
    setPage(1);
    fetchData(selectedCols, conditions, 1, sortCol, sortDir);
  };

  const clearFilters = () => {
    track("filter_cleared");
    setConditions([]);
    setPage(1);
    fetchData(selectedCols, [], 1, sortCol, sortDir);
  };

  // Sort
  const handleSort = (col: string) => {
    const dir = sortCol === col && sortDir === "asc" ? "desc" : "asc";
    setSortCol(col);
    setSortDir(dir);
    fetchData(selectedCols, conditions, page, col, dir);
  };

  // Date formatter (for status bar — keeps time)
  function formatDate(str: string) {
    if (!str) return "";
    const [date, time] = str.split(" ");
    if (!date) return "";
    const [y, m, d] = date.split("-");
    if (!y || !m || !d) return str;
    return `${time ? time + " - " : ""}${d}/${m}/${y}`;
  }

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const goPage = (p: number) => {
    setPage(p);
    fetchData(selectedCols, conditions, p, sortCol, sortDir);
  };

  const pageNums = () => {
    const nums: number[] = [];
    let s = Math.max(1, page - 2),
      e = Math.min(totalPages, s + 4);
    if (e - s < 4) s = Math.max(1, e - 4);
    for (let i = s; i <= e; i++) nums.push(i);
    return nums;
  };

  // Save filter
  const handleSave = async () => {
    if (!filterName.trim()) return;
    const trimmedName = filterName.trim();
    const currentFilters = await getSavedFilters();
    const sameNameFilters = currentFilters.filter(
      (sf) => sf.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    for (const dup of sameNameFilters) {
      await deleteFilterFile(dup.id);
    }
    const f: SavedFilter = {
      id: Date.now().toString(),
      name: trimmedName,
      description: filterDesc.trim() || undefined,
      selectedColumns: selectedCols,
      conditions,
      createdAt: new Date().toISOString(),
    };

    await saveFilterToFile(f);
    const updatedFilters = await getSavedFilters();
    setSavedFilters(updatedFilters);
    track("filter_saved", { name: trimmedName });

    setShowSave(false);
    setFilterName("");
    setFilterDesc("");
  };

  const loadFilter = (f: SavedFilter) => {
    track("filter_loaded", { name: f.name });
    setSelectedCols(f.selectedColumns);
    setConditions(f.conditions);
    setColorRules(f.colorRules ?? []);
    setFormulaColumns(f.formulaColumns ?? []);
    setAnnotationColumns(f.annotationColumns ?? []);
    setLookupColumns(f.lookupColumns ?? []);
    setTemplateColumns(f.templateColumns ?? []);
    setAnnotationValues({});
    setPage(1);
    fetchData(f.selectedColumns, f.conditions, 1);
  };

  const handleAnnotationChange = (
    rowId: number,
    colId: string,
    value: string,
  ) => {
    setAnnotationValues((prev) => ({ ...prev, [`${rowId}:${colId}`]: value }));
    setAnnotation(rowId, colId, value).catch(() => {});
  };

  const deleteFilter = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteFilterFile(id);
    setSavedFilters((p) => p.filter((f) => f.id !== id));
    track("filter_deleted");
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Tem certeza? Isso apagará todos os dados CSV e voltará os filtros para o padrão.",
      )
    )
      return;

    await resetAllData();
    track("reset_all");

    // Reset all UI state
    setRows([]);
    setTotal(0);
    setRowCount(0);
    setMinDate("");
    setMaxDate("");
    setSelectedCols([]);
    setConditions([]);
    setColorRules([]);
    setFormulaColumns([]);
    setFormulaValues([]);
    setAnnotationColumns([]);
    setTemplateColumns([]);
    setAnnotationValues({});
    setPage(1);
    setSortCol(undefined);
    setSortDir("asc");

    // Reload default filters
    const filters = await getSavedFilters();
    setSavedFilters(filters);
  };

  // Export single filter JSON
  const exportFilter = (f: SavedFilter, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([JSON.stringify(f, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filtro_${f.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export all filters
  const exportAllFilters = () => {
    const blob = new Blob([JSON.stringify(savedFilters, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "todos_filtros.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import filters from JSON
  const importFilters = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const filtersToImport: SavedFilter[] = Array.isArray(parsed)
          ? parsed
          : [parsed];
        let imported = 0;

        await deleteDefaultFilters();

        for (const f of filtersToImport) {
          if (f.selectedColumns && f.conditions) {
            const filter: SavedFilter = {
              ...f,
              id: `imported_${Date.now()}_${imported}`,
              name: f.name || `Filtro importado ${imported + 1}`,
              createdAt: f.createdAt || new Date().toISOString(),
            };
            await saveFilterToFile(filter);
            imported++;
          }
        }

        const updated = await getSavedFilters();
        setSavedFilters(updated);
        alert(`${imported} filtro(s) importado(s)!`);
      } catch (err) {
        alert("Erro ao importar filtros. Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  };

  // Export CSV
  const exportCSV = async () => {
    const csvContent = await exportFilteredCSV(selectedCols, conditions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dados_filtrados.csv";
    a.click();
    URL.revokeObjectURL(url);
    track("csv_exported", { rows: total });
  };

  const getOps = (col: string) => {
    const c = columns.find((x) => x.name === col);
    if (c?.type === "number") return OPS_NUM;
    if (c?.type === "date") return OPS_DATE;
    return OPS_TEXT;
  };

  const filteredCols = colSearch
    ? columns.filter((c) =>
        c.label.toLowerCase().includes(colSearch.toLowerCase()),
      )
    : columns;

  const hasData = rowCount > 0;

  return (
    <div className="app">
      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">LAB SHEETS</div>
          <a
            href="/semanas"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 6,
              color: "#6366f1",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            🗓 Escala
          </a>
          <a
            href="/whatsapp"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 6,
              color: "#22c55e",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            📱 WhatsApp
          </a>
        </div>

        <div className="sidebar-scroll">
          {/* Upload */}
          <div className="section">
            <div className="section-title">Upload de Dados</div>
            <div
              className={`upload-zone ${dragging ? "active" : ""}`}
              style={{ margin: "0 4px 8px" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) handleUpload(f);
              }}
            >
              <div className="icon">{uploading ? "⏳" : "📄"}</div>
              <div className="label">
                {uploading ? "Processando..." : "Upload CSV"}
              </div>
              <div className="hint">Arraste ou clique • ; , TAB</div>
              {uploading && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <button
              className="btn btn-sm btn-red"
              style={{ width: "100%", marginTop: 6 }}
              onClick={handleReset}
            >
              🔄 Resetar Dados
            </button>
          </div>

          {hasData && (
            <>
              {/* Stats */}
              <div className="stats-row">
                <div className="stat">
                  <div className="stat-value">
                    {rowCount.toLocaleString("pt-BR")}
                  </div>
                  <div className="stat-label">Linhas</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {total.toLocaleString("pt-BR")}
                  </div>
                  <div className="stat-label">Filtrado</div>
                </div>
              </div>

              {/* Columns */}
              <div className="section">
                <div className="section-title">
                  Colunas ({selectedCols.length}/{columns.length})
                  <div className="col-actions" style={{ padding: 0 }}>
                    <button className="link-btn" onClick={selectAllCols}>
                      Todas
                    </button>
                    <button className="link-btn" onClick={deselectAllCols}>
                      Nenhuma
                    </button>
                  </div>
                </div>
                <div style={{ padding: "0 4px" }}>
                  <input
                    className="col-search"
                    placeholder="Buscar coluna..."
                    value={colSearch}
                    onChange={(e) => setColSearch(e.target.value)}
                  />
                </div>
                <div className="col-list">
                  {filteredCols.map((c) => (
                    <div
                      key={c.name}
                      className={`col-item ${selectedCols.includes(c.name) ? "on" : ""}`}
                      onClick={() => toggleCol(c.name)}
                    >
                      <div className="col-check">
                        {selectedCols.includes(c.name) && "✓"}
                      </div>
                      <span>{c.label}</span>
                      <span className="col-type">
                        {c.type === "number"
                          ? "NUM"
                          : c.type === "date"
                            ? "DATA"
                            : "TXT"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="section">
                <div className="section-title">
                  Filtros ({conditions.length})
                  <button
                    className="btn btn-sm btn-blue"
                    onClick={addCondition}
                  >
                    + Filtro
                  </button>
                </div>
                <div style={{ padding: "0 4px" }}>
                  {conditions.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "12px 0",
                        color: "var(--text-3)",
                        fontSize: 12,
                      }}
                    >
                      Sem filtros ativos
                    </div>
                  )}
                  {conditions.map((c, i) => (
                    <div key={i} className="filter-card">
                      <div className="filter-row">
                        <select
                          value={c.column}
                          onChange={(e) =>
                            updateCond(i, "column", e.target.value)
                          }
                        >
                          {columns.map((col) => (
                            <option key={col.name} value={col.name}>
                              {col.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={c.operator}
                          onChange={(e) =>
                            updateCond(i, "operator", e.target.value)
                          }
                        >
                          {getOps(c.column).map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                        {c.operator !== "is_null" &&
                          c.operator !== "is_not_null" &&
                          c.operator !== "is_today" &&
                          c.operator !== "is_future" &&
                          c.operator !== "is_past" &&
                          (SELECT_COLUMNS.has(c.column) &&
                          c.operator !== "in" &&
                          c.operator !== "not_in" &&
                          columns.find((x) => x.name === c.column)?.type !==
                            "date" &&
                          distinctValues[c.column] ? (
                            <select
                              value={c.value}
                              onChange={(e) =>
                                updateCond(i, "value", e.target.value)
                              }
                            >
                              <option value="">-- Selecione --</option>
                              {distinctValues[c.column].map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                columns.find((x) => x.name === c.column)
                                  ?.type === "date"
                                  ? "date"
                                  : "text"
                              }
                              placeholder="Valor"
                              value={c.value}
                              onChange={(e) =>
                                updateCond(i, "value", e.target.value)
                              }
                            />
                          ))}
                        {(c.operator === "between" ||
                          c.operator === "date_between") && (
                          <input
                            type={
                              columns.find((x) => x.name === c.column)?.type ===
                              "date"
                                ? "date"
                                : "text"
                            }
                            placeholder="Até"
                            value={c.value2 || ""}
                            onChange={(e) =>
                              updateCond(i, "value2", e.target.value)
                            }
                            style={{ maxWidth: 90 }}
                          />
                        )}
                        <button
                          className="btn btn-sm btn-icon btn-red"
                          onClick={() => removeCond(i)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="btn-group" style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-primary btn-full"
                      onClick={applyFilters}
                    >
                      {loading ? <span className="spinner" /> : "🔍"} Aplicar
                    </button>
                  </div>
                  {conditions.length > 0 && (
                    <button
                      className="link-btn"
                      style={{
                        marginTop: 4,
                        display: "block",
                        textAlign: "center",
                        width: "100%",
                      }}
                      onClick={clearFilters}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Saved Filters */}
              <div className="section">
                <div className="section-title">
                  Filtros Salvos ({savedFilters.length})
                </div>
                <div style={{ padding: "0 4px" }}>
                  <div className="btn-group" style={{ marginBottom: 8 }}>
                    <button
                      className="btn btn-sm btn-green"
                      onClick={() => setShowSave(true)}
                    >
                      💾 Salvar Atual
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => filterFileRef.current?.click()}
                    >
                      📥 Importar
                    </button>
                    {savedFilters.length > 0 && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={exportAllFilters}
                      >
                        📤 Exportar Todos
                      </button>
                    )}
                  </div>
                  <input
                    ref={filterFileRef}
                    type="file"
                    accept=".json"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importFilters(f);
                    }}
                  />

                  {savedFilters.map((f) => (
                    <div
                      key={f.id}
                      className="saved-item"
                      onClick={() => loadFilter(f)}
                    >
                      <div>
                        <div className="saved-name">{f.name}</div>
                        <div className="saved-meta">
                          {f.conditions.length} filtro(s) •{" "}
                          {f.selectedColumns.length} col(s)
                          {f.description && ` • ${f.description}`}
                        </div>
                      </div>
                      <div className="saved-actions">
                        <a
                          href={`/filters/${f.id}`}
                          className="btn btn-sm btn-icon btn-blue"
                          title="Abrir página do filtro"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↗
                        </a>
                        <button
                          className="btn btn-sm btn-icon btn-ghost"
                          onClick={(e) => exportFilter(f, e)}
                          title="Exportar"
                        >
                          📤
                        </button>
                        <button
                          className="btn btn-sm btn-icon btn-red"
                          onClick={(e) => deleteFilter(f.id, e)}
                          title="Excluir"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== MAIN ===== */}
      <div className="main">
        {!hasData ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="empty">
              <div className="icon">📊</div>
              <p>Faça upload de um CSV para analisar localmente</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>
                Os dados são processados diretamente no seu navegador,
                garantindo velocidade e privacidade.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="main-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "var(--text-0)" }}>
                  Resultados
                </span>
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                  {total.toLocaleString("pt-BR")} registro(s)
                </span>
              </div>
              <div className="btn-group">
                <button className="btn btn-sm btn-ghost" onClick={exportCSV}>
                  📥 Exportar CSV
                </button>
              </div>
            </div>

            <div className="main-content">
              {loading ? (
                <div className="loading-center">
                  <span className="spinner" /> Carregando...
                </div>
              ) : rows.length === 0 ? (
                <div className="empty">
                  <div className="icon">🔍</div>
                  <p>Nenhum resultado com os filtros atuais</p>
                </div>
              ) : (
                <DataTable
                  rows={rows}
                  selectedCols={selectedCols}
                  columns={columns}
                  colorRules={colorRules}
                  formulaColumns={formulaColumns}
                  formulaValues={formulaValues}
                  annotationColumns={annotationColumns}
                  annotationValues={annotationValues}
                  lookupColumns={lookupColumns}
                  lookupValues={lookupValues}
                  onAnnotationChange={handleAnnotationChange}
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={handleSort}
                  templateColumns={templateColumns}
                />
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)} de{" "}
                  {total.toLocaleString("pt-BR")}
                </span>
                <div className="page-btns">
                  <button
                    className="pg-btn"
                    disabled={page <= 1}
                    onClick={() => goPage(1)}
                  >
                    «
                  </button>
                  <button
                    className="pg-btn"
                    disabled={page <= 1}
                    onClick={() => goPage(page - 1)}
                  >
                    ‹
                  </button>
                  {pageNums().map((p) => (
                    <button
                      key={p}
                      className={`pg-btn ${p === page ? "active" : ""}`}
                      onClick={() => goPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className="pg-btn"
                    disabled={page >= totalPages}
                    onClick={() => goPage(page + 1)}
                  >
                    ›
                  </button>
                  <button
                    className="pg-btn"
                    disabled={page >= totalPages}
                    onClick={() => goPage(totalPages)}
                  >
                    »
                  </button>
                </div>
              </div>
            )}

            {/* Status Bar */}
            <div className="status-bar">
              <div>
                <span className="status-dot ok" />
                {rowCount.toLocaleString("pt-BR")} registros carregados
                {formatDate(minDate) &&
                  ` • ${formatDate(minDate)} a ${formatDate(maxDate)}`}
              </div>
              <div>Processamento 100% Local (Client-side)</div>
            </div>
          </>
        )}
      </div>

      {/* ===== SAVE MODAL ===== */}
      {showSave && (
        <div className="modal-bg" onClick={() => setShowSave(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Salvar Filtro</h3>
            <input
              className="modal-input"
              placeholder="Nome do filtro"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
            <input
              className="modal-input"
              placeholder="Descrição (opcional)"
              value={filterDesc}
              onChange={(e) => setFilterDesc(e.target.value)}
            />
            <div
              style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}
            >
              {selectedCols.length} coluna(s) • {conditions.length} filtro(s)
            </div>
            <div className="btn-group" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowSave(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
