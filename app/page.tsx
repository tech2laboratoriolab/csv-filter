"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { evaluateColorRules } from "@/lib/colorRules";
import type { ColorRule } from "@/lib/types";

const SELECT_COLUMNS = new Set(["nom_medico"]);

interface ColumnDef {
  name: string;
  label: string;
  type: "text" | "number" | "date";
}

interface FilterCondition {
  column: string;
  operator: string;
  value: string;
  value2?: string;
}

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  selectedColumns: string[];
  conditions: FilterCondition[];
  colorRules?: ColorRule[];
  createdAt: string;
}

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
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scraping, setScraping] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [colSearch, setColSearch] = useState("");
  const [colorRules, setColorRules] = useState<ColorRule[]>([]);
  const [dragging, setDragging] = useState(false);
  const [distinctValues, setDistinctValues] = useState<Record<string, string[]>>({});
  const fetchedCols = useRef<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const filterFileRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 50;

  // Init: load stats and saved filters
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.columns) setColumns(d.columns);
        if (d.total > 0) {
          setRowCount(d.total);
          setMinDate(d.minDate || "");
          setMaxDate(d.maxDate || "");
          setSelectedCols(d.columns.map((c: ColumnDef) => c.name));
          fetchData(
            d.columns.map((c: ColumnDef) => c.name),
            [],
            1,
          );
        }
      })
      .catch(() => {});
    fetch("/api/filters")
      .then((r) => r.json())
      .then((d) => {
        if (d.filters) setSavedFilters(d.filters);
      })
      .catch(() => {});
  }, []);

  // Fetch distinct values for SELECT_COLUMNS when those columns appear in conditions
  useEffect(() => {
    const needed = [...new Set(conditions.map((c) => c.column))].filter(
      (col) => SELECT_COLUMNS.has(col) && !fetchedCols.current.has(col),
    );
    for (const col of needed) {
      fetchedCols.current.add(col);
      fetch(`/api/columns?column=${col}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.values)
            setDistinctValues((prev) => ({ ...prev, [col]: d.values }));
        })
        .catch(() => fetchedCols.current.delete(col));
    }
  }, [conditions]);

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
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedColumns: cols ?? selectedCols,
            conditions: conds ?? conditions,
            page: pg ?? page,
            pageSize: PAGE_SIZE,
            sortColumn: sCol ?? sortCol,
            sortDir: sDir ?? sortDir,
          }),
        });
        const d = await res.json();
        setRows(d.rows || []);
        setTotal(d.total || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [selectedCols, conditions, page, sortCol, sortDir],
  );

  // Upload
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(0);
    const iv = setInterval(() => setProgress((p) => Math.min(p + 3, 90)), 150);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      clearInterval(iv);
      setProgress(100);
      if (d.success) {
        // Reload stats
        const stats = await fetch("/api/stats").then((r) => r.json());
        setColumns(stats.columns);
        setRowCount(stats.total);
        setMinDate(stats.minDate || "");
        setMaxDate(stats.maxDate || "");
        const allCols = stats.columns.map((c: ColumnDef) => c.name);
        setSelectedCols(allCols);
        setConditions([]);
        setPage(1);
        fetchData(allCols, [], 1);
      } else {
        alert(d.error);
      }
    } catch {
      clearInterval(iv);
      alert("Erro no upload");
    } finally {
      setUploading(false);
    }
  }, []);

  // Scraper
  const handleScrape = useCallback(async () => {
    setScraping(true);
    try {
      const res = await fetch("/api/scraper", { method: "POST" });
      const d = await res.json();
      if (d.success) {
        const stats = await fetch("/api/stats").then((r) => r.json());
        setColumns(stats.columns);
        setRowCount(stats.total);
        setMinDate(stats.minDate || "");
        setMaxDate(stats.maxDate || "");
        const allCols = stats.columns.map((c: ColumnDef) => c.name);
        setSelectedCols(allCols);
        setConditions([]);
        setPage(1);
        fetchData(allCols, [], 1);
        alert("Dados atualizados com sucesso!");
      } else {
        alert(`Erro no scraper:\n${d.error || ""}\n\nLog:\n${d.output || ""}`);
      }
    } catch {
      alert("Erro ao chamar o scraper");
    } finally {
      setScraping(false);
    }
  }, [fetchData]);

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
    setPage(1);
    fetchData(selectedCols, conditions, 1, sortCol, sortDir);
  };

  const clearFilters = () => {
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
    const [date, time] = str.split(" ");
    const [y, m, d] = date.split("-");
    return `${time} - ${d}/${m}/${y}`;
  }

  // Date formatter for table cells — Brazilian format, no time
  function formatDateBR(str: string): string {
    if (!str) return '';
    const [datePart] = str.split(' ');
    const parts = datePart.split('-');
    if (parts.length !== 3) return str;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
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
    const f: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      description: filterDesc.trim() || undefined,
      selectedColumns: selectedCols,
      conditions,
      createdAt: new Date().toISOString(),
    };
    await fetch("/api/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setSavedFilters((p) => [f, ...p]);
    setShowSave(false);
    setFilterName("");
    setFilterDesc("");
  };

  const loadFilter = (f: SavedFilter) => {
    setSelectedCols(f.selectedColumns);
    setConditions(f.conditions);
    setColorRules(f.colorRules ?? []);
    setPage(1);
    fetchData(f.selectedColumns, f.conditions, 1);
  };

  const deleteFilter = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/filters", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSavedFilters((p) => p.filter((f) => f.id !== id));
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
  const importFilters = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/filters", { method: "POST", body: fd });
    const d = await res.json();
    if (d.success) {
      const updated = await fetch("/api/filters").then((r) => r.json());
      setSavedFilters(updated.filters || []);
      alert(`${d.imported} filtro(s) importado(s)!`);
    }
  };

  // Export CSV
  const exportCSV = async () => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedColumns: selectedCols, conditions }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dados_filtrados.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getOps = (col: string) => {
    const c = columns.find((x) => x.name === col);
    if (c?.type === "number") return OPS_NUM;
    if (c?.type === "date") return OPS_DATE;
    return OPS_TEXT;
  };

  const getLabel = (name: string) =>
    columns.find((c) => c.name === name)?.label || name;

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
          <div className="logo">
            CSV<span>Filter</span>Pro
          </div>
          <a
            href="/whatsapp"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 6,
              color: "#22c55e",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 600,
              marginTop: 10,
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
              className="btn btn-primary btn-full"
              style={{ margin: "0 4px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={handleScrape}
              disabled={scraping || uploading}
            >
              {scraping ? <span className="spinner" /> : "🔄"} {scraping ? "Coletando..." : "Atualizar dados"}
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
                          c.operator !== "is_past" && (
                            SELECT_COLUMNS.has(c.column) &&
                            c.operator !== "in" &&
                            c.operator !== "not_in" &&
                            columns.find((x) => x.name === c.column)?.type !== "date" &&
                            distinctValues[c.column] ? (
                              <select
                                value={c.value}
                                onChange={(e) =>
                                  updateCond(i, "value", e.target.value)
                                }
                              >
                                <option value="">-- Selecione --</option>
                                {distinctValues[c.column].map((v) => (
                                  <option key={v} value={v}>{v}</option>
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
                            )
                          )}
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
              <p>Faça upload de um CSV ou aguarde a coleta automática</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>
                O scraper roda às 06:00, 12:00 e 18:00
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
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        {selectedCols.map((col) => (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className={sortCol === col ? "sorted" : ""}
                          >
                            {getLabel(col)}
                            <span style={{ marginLeft: 3, opacity: 0.5 }}>
                              {sortCol === col
                                ? sortDir === "asc"
                                  ? "↑"
                                  : "↓"
                                : "↕"}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const { rowStyle, cellStyles } = colorRules.length
                          ? evaluateColorRules(row, colorRules)
                          : { rowStyle: {}, cellStyles: {} };
                        return (
                          <tr key={i} style={rowStyle as React.CSSProperties}>
                            {selectedCols.map((col) => {
                              const colType = columns.find(c => c.name === col)?.type;
                              const displayVal = colType === 'date'
                                ? formatDateBR(String(row[col] ?? ''))
                                : String(row[col] ?? '');
                              return (
                                <td
                                  key={col}
                                  title={displayVal}
                                  style={(cellStyles[col] ?? {}) as React.CSSProperties}
                                >
                                  {displayVal}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
              <div>Coleta automática: 06:00, 12:00, 18:00</div>
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
