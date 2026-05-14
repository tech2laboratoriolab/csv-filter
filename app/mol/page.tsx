"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  MOL_COLUMNS,
  getMolStats,
  getMolColumnValues,
  queryMolFiltered,
  exportMolCSV,
  clearMolData,
  FilterCondition,
} from "@/lib/clientDb";
import { getOpsForType } from "@/lib/operators";

const PAGE_SIZE = 50;

type SortDir = "asc" | "desc";

export default function MolPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{
    total: number;
    minDate: string | null;
    maxDate: string | null;
  }>({ total: 0, minDate: null, maxDate: null });
  const [selectedCols, setSelectedCols] = useState<string[]>(
    MOL_COLUMNS.map((c) => c.name),
  );
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [distinctValues, setDistinctValues] = useState<
    Record<string, string[]>
  >({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (type: "success" | "error", msg: string) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ type, msg });
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const fetchData = useCallback(
    async (
      cols = selectedCols,
      conds = conditions,
      p = page,
      sc = sortColumn,
      sd = sortDir,
    ) => {
      setLoading(true);
      try {
        const { rows: r, total: t } = await queryMolFiltered(
          cols,
          conds,
          p,
          PAGE_SIZE,
          sc,
          sd,
        );
        setRows(r);
        setTotal(t);
        setTotalPages(Math.max(1, Math.ceil(t / PAGE_SIZE)));
      } finally {
        setLoading(false);
      }
    },
    [selectedCols, conditions, page, sortColumn, sortDir],
  );

  const loadStats = useCallback(async () => {
    const s = await getMolStats();
    setStats(s);
  }, []);

  useEffect(() => {
    loadStats();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = useCallback(() => {
    setPage(1);
    fetchData(selectedCols, conditions, 1, sortColumn, sortDir);
  }, [selectedCols, conditions, sortColumn, sortDir, fetchData]);

  const handleSort = useCallback(
    (col: string) => {
      const newDir =
        sortColumn === col ? (sortDir === "asc" ? "desc" : "asc") : "asc";
      setSortColumn(col);
      setSortDir(newDir);
      fetchData(selectedCols, conditions, page, col, newDir);
    },
    [sortColumn, sortDir, selectedCols, conditions, page, fetchData],
  );

  const handleExport = useCallback(async () => {
    try {
      const csv = await exportMolCSV(selectedCols, conditions);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "biomolecular.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("error", "Falha ao exportar CSV.");
    }
  }, [selectedCols, conditions, showToast]);

  const handleClear = useCallback(async () => {
    if (!confirm("Limpar todos os dados biomoleculares?")) return;
    await clearMolData();
    await loadStats();
    setRows([]);
    setTotal(0);
    setPage(1);
    showToast("success", "Dados biomoleculares removidos.");
  }, [loadStats, showToast]);

  const addCondition = useCallback(() => {
    setConditions((prev) => [
      ...prev,
      { column: MOL_COLUMNS[0].name, operator: "contains", value: "" },
    ]);
  }, []);

  const removeCondition = useCallback((idx: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateCondition = useCallback(
    (idx: number, patch: Partial<FilterCondition>) => {
      setConditions((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const loadDistinct = useCallback(async (col: string) => {
    if (distinctValues[col]) return;
    const vals = await getMolColumnValues(col);
    setDistinctValues((prev) => ({ ...prev, [col]: vals }));
  }, [distinctValues]);

  const toggleCol = useCallback((name: string) => {
    setSelectedCols((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );
  }, []);

  const startRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span>🧬</span>
            <span>Biomolecular</span>
          </div>
          <a
            href="/"
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              textDecoration: "none",
            }}
          >
            ← Voltar
          </a>
        </div>

        <div className="sidebar-scroll">
          {/* Stats */}
          {stats.total > 0 && (
            <div className="section" style={{ padding: "12px 16px" }}>
              <div className="section-title">Resumo</div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-2)",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <strong style={{ color: "var(--text-1)" }}>
                    {stats.total}
                  </strong>{" "}
                  registros
                </div>
                {stats.minDate && (
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {stats.minDate} → {stats.maxDate}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Columns */}
          <div className="section" style={{ padding: "0 16px 12px" }}>
            <div
              className="section-title"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 12,
              }}
            >
              <span>Colunas</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setSelectedCols(MOL_COLUMNS.map((c) => c.name))
                  }
                >
                  Todas
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedCols([])}
                >
                  Nenhuma
                </button>
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {MOL_COLUMNS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => toggleCol(c.name)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: `1px solid ${selectedCols.includes(c.name) ? "#a78bfa" : "var(--border)"}`,
                    background: selectedCols.includes(c.name)
                      ? "rgba(139,92,246,0.15)"
                      : "transparent",
                    color: selectedCols.includes(c.name)
                      ? "#a78bfa"
                      : "var(--text-3)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="section" style={{ padding: "0 16px 12px" }}>
            <div
              className="section-title"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 12,
              }}
            >
              <span>Filtros</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={addCondition}
              >
                + Adicionar
              </button>
            </div>

            {conditions.map((cond, idx) => {
              const colDef = MOL_COLUMNS.find((c) => c.name === cond.column);
              const ops = getOpsForType(colDef?.type ?? "text");
              const needsValue = !["is_null", "is_not_null"].includes(
                cond.operator,
              );
              const needsTwo = ["between", "date_between"].includes(
                cond.operator,
              );

              return (
                <div key={idx} className="filter-card" style={{ marginTop: 8 }}>
                  <div className="filter-row">
                    <select
                      value={cond.column}
                      onChange={(e) => {
                        updateCondition(idx, {
                          column: e.target.value,
                          operator: "contains",
                          value: "",
                        });
                        loadDistinct(e.target.value);
                      }}
                    >
                      {MOL_COLUMNS.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.operator}
                      onChange={(e) =>
                        updateCondition(idx, {
                          operator: e.target.value as FilterCondition["operator"],
                          value: "",
                        })
                      }
                    >
                      {ops.map((op) => (
                        <option key={op.v} value={op.v}>
                          {op.l}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeCondition(idx)}
                      style={{ flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>

                  {needsValue && (
                    <div className="filter-row" style={{ marginTop: 4 }}>
                      {distinctValues[cond.column] &&
                      distinctValues[cond.column].length > 0 &&
                      !["contains", "not_contains", "in", "not_in"].includes(
                        cond.operator,
                      ) ? (
                        <select
                          value={cond.value ?? ""}
                          onChange={(e) =>
                            updateCondition(idx, { value: e.target.value })
                          }
                          style={{ flex: 1 }}
                        >
                          <option value="">-- selecionar --</option>
                          {distinctValues[cond.column].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={colDef?.type === "date" ? "date" : "text"}
                          placeholder="Valor..."
                          value={cond.value ?? ""}
                          onChange={(e) =>
                            updateCondition(idx, { value: e.target.value })
                          }
                          onFocus={() => loadDistinct(cond.column)}
                          style={{ flex: 1 }}
                        />
                      )}
                      {needsTwo && (
                        <input
                          type={colDef?.type === "date" ? "date" : "text"}
                          placeholder="Até..."
                          value={cond.value2 ?? ""}
                          onChange={(e) =>
                            updateCondition(idx, { value2: e.target.value })
                          }
                          style={{ flex: 1 }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {conditions.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  className="btn btn-blue btn-sm"
                  style={{ flex: 1 }}
                  onClick={applyFilters}
                >
                  Aplicar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setConditions([]);
                    setPage(1);
                    fetchData(selectedCols, [], 1, sortColumn, sortDir);
                  }}
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            className="section"
            style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}
          >
            <button
              className="btn btn-green btn-sm btn-full"
              onClick={handleExport}
              disabled={total === 0}
            >
              ⬇ Exportar CSV
            </button>
            <button
              className="btn btn-danger btn-sm btn-full"
              onClick={handleClear}
              disabled={stats.total === 0}
            >
              🗑 Limpar dados
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="main-content">
        {/* Header bar */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--bg-1)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
            Resultados
          </span>
          {total > 0 && (
            <span
              style={{
                fontSize: 12,
                background: "rgba(139,92,246,0.15)",
                color: "#a78bfa",
                padding: "2px 8px",
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {total}
            </span>
          )}
          {loading && (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              Carregando...
            </span>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {rows.length === 0 && !loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 12,
                color: "var(--text-3)",
              }}
            >
              <span style={{ fontSize: 40 }}>🧬</span>
              <span style={{ fontSize: 14 }}>
                {stats.total === 0
                  ? "Faça upload de um CSV biomolecular (com cabeçalho guiaipog)"
                  : "Nenhum resultado para os filtros aplicados"}
              </span>
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  {(selectedCols.length > 0
                    ? selectedCols
                    : MOL_COLUMNS.map((c) => c.name)
                  ).map((colName) => {
                    const def = MOL_COLUMNS.find((c) => c.name === colName);
                    const isSorted = sortColumn === colName;
                    return (
                      <th
                        key={colName}
                        onClick={() => handleSort(colName)}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          background: "var(--bg-2)",
                          borderBottom: "1px solid var(--border)",
                          fontWeight: 600,
                          fontSize: 11,
                          color: isSorted ? "#a78bfa" : "var(--text-2)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        {def?.label ?? colName}
                        {isSorted ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr
                    key={ri}
                    style={{
                      background:
                        ri % 2 === 0 ? "var(--bg-0)" : "var(--bg-1)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {(selectedCols.length > 0
                      ? selectedCols
                      : MOL_COLUMNS.map((c) => c.name)
                    ).map((colName) => (
                      <td
                        key={colName}
                        style={{
                          padding: "6px 12px",
                          color: "var(--text-1)",
                          maxWidth: 300,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row[colName] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "8px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg-1)",
              flexShrink: 0,
              fontSize: 12,
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const p = Math.max(1, page - 1);
                setPage(p);
                fetchData(selectedCols, conditions, p, sortColumn, sortDir);
              }}
              disabled={page === 1}
            >
              ← Anterior
            </button>
            <span style={{ color: "var(--text-2)" }}>
              {startRow}–{endRow} de {total}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const p = Math.min(totalPages, page + 1);
                setPage(p);
                fetchData(selectedCols, conditions, p, sortColumn, sortDir);
              }}
              disabled={page === totalPages}
            >
              Próxima →
            </button>
          </div>
        )}

        {/* Status bar */}
        <div
          style={{
            padding: "4px 20px",
            background: "var(--bg-2)",
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-3)",
            flexShrink: 0,
          }}
        >
          {stats.total > 0
            ? `✓ ${stats.total} registros carregados • Processamento 100% Local`
            : "Nenhum dado carregado"}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: toast.type === "success" ? "#166534" : "#7f1d1d",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
