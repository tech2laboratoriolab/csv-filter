"use client";

import { useRef, useState } from "react";
import type {
  ColumnDef,
  ColorRule,
  FormulaColumn,
  AnnotationColumn,
  LookupColumn,
  TemplateColumn,
} from "@/lib/clientDb";
import { evaluateColorRules } from "@/lib/colorRules";

interface DataTableProps {
  rows: Record<string, unknown>[];
  selectedCols: string[];
  columns: ColumnDef[];
  colorRules: ColorRule[];
  formulaColumns: FormulaColumn[];
  formulaValues: string[][];
  annotationColumns: AnnotationColumn[];
  annotationValues: Record<string, string>;
  lookupColumns: LookupColumn[];
  lookupValues: string[][];
  templateColumns: TemplateColumn[];
  onAnnotationChange: (rowId: number, colId: string, value: string) => void;
  sortCol?: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
}

type DisplayCol =
  | { type: "data"; name: string }
  | { type: "formula"; fc: FormulaColumn; fcIdx: number }
  | { type: "annotation"; ac: AnnotationColumn; acIdx: number }
  | { type: "lookup"; lc: LookupColumn; lcIdx: number }
  | { type: "template"; tc: TemplateColumn; tcIdx: number };

function buildDisplayCols(
  selectedCols: string[],
  formulaColumns: FormulaColumn[],
  annotationColumns: AnnotationColumn[],
  lookupColumns: LookupColumn[] = [],
  templateColumns: TemplateColumn[] = [],
): DisplayCol[] {
  const result: DisplayCol[] = [];

  for (const name of selectedCols) {
    result.push({ type: "data", name });
    formulaColumns.forEach((fc, fcIdx) => {
      if (fc.insertAfterColumn === name)
        result.push({ type: "formula", fc, fcIdx });
    });
    annotationColumns.forEach((ac, acIdx) => {
      if (ac.insertAfterColumn === name)
        result.push({ type: "annotation", ac, acIdx });
    });
    lookupColumns.forEach((lc, lcIdx) => {
      if (lc.insertAfterColumn === name)
        result.push({ type: "lookup", lc, lcIdx });
    });
    templateColumns.forEach((tc, tcIdx) => {
      if (tc.insertAfterColumn === name)
        result.push({ type: "template", tc, tcIdx });
    });
  }

  formulaColumns.forEach((fc, fcIdx) => {
    if (!fc.insertAfterColumn || !selectedCols.includes(fc.insertAfterColumn))
      result.push({ type: "formula", fc, fcIdx });
  });
  annotationColumns.forEach((ac, acIdx) => {
    if (!ac.insertAfterColumn || !selectedCols.includes(ac.insertAfterColumn))
      result.push({ type: "annotation", ac, acIdx });
  });
  lookupColumns.forEach((lc, lcIdx) => {
    if (!lc.insertAfterColumn || !selectedCols.includes(lc.insertAfterColumn))
      result.push({ type: "lookup", lc, lcIdx });
  });
  templateColumns.forEach((tc, tcIdx) => {
    if (!tc.insertAfterColumn || !selectedCols.includes(tc.insertAfterColumn))
      result.push({ type: "template", tc, tcIdx });
  });

  return result;
}

function formatDate(val: string): string {
  if (!val) return "";
  const [datePart, timePart] = val.split(" ");
  const parts = datePart.split("-");
  if (parts.length !== 3) return val;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export default function DataTable({
  rows,
  selectedCols,
  columns,
  colorRules,
  formulaColumns,
  formulaValues,
  annotationColumns,
  annotationValues,
  lookupColumns,
  lookupValues,
  templateColumns,
  onAnnotationChange,
  sortCol,
  sortDir,
  onSort,
}: DataTableProps) {
  const getLabel = (name: string) =>
    columns.find((c) => c.name === name)?.label ?? name;
  const displayCols = buildDisplayCols(
    selectedCols,
    formulaColumns,
    annotationColumns,
    lookupColumns,
    templateColumns,
  );
  // Track pending (uncommitted) edits keyed by "rowId:colId"
  const pendingRef = useRef<Record<string, string>>({});
  const [copiedTemplateKey, setCopiedTemplateKey] = useState<string | null>(
    null,
  );

  const copyTemplateText = async (text: string, key: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedTemplateKey(key);
      setTimeout(() => {
        setCopiedTemplateKey((prev) => (prev === key ? null : prev));
      }, 1200);
    } catch {
      // ignore clipboard failures silently to avoid breaking table rendering
    }
  };

  if (!rows.length) {
    return (
      <div className="empty">
        <div className="icon">🔍</div>
        <p>Nenhum resultado com os filtros atuais</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {displayCols.map((col) => {
              if (col.type === "formula") {
                return (
                  <th
                    key={`fc-${col.fc.id}`}
                    style={{
                      width: col.fc.width ?? 150,
                      color: "var(--purple)",
                    }}
                  >
                    ƒ {col.fc.label}
                  </th>
                );
              }
              if (col.type === "annotation") {
                return (
                  <th
                    key={`ac-${col.ac.id}`}
                    style={{
                      width: col.ac.width ?? 180,
                      color: "var(--green)",
                    }}
                  >
                    ✏ {col.ac.label}
                  </th>
                );
              }
              if (col.type === "lookup") {
                return (
                  <th
                    key={`lc-${col.lc.id}`}
                    style={{ width: col.lc.width ?? 220, color: "var(--blue)" }}
                  >
                    ⌗ {col.lc.label}
                  </th>
                );
              }
              if (col.type === "template") {
                return (
                  <th
                    key={`tc-${col.tc.id}`}
                    style={{
                      width: col.tc.width ?? 280,
                      color: "var(--yellow)",
                    }}
                  >
                    ✉ {col.tc.label}
                  </th>
                );
              }
              return (
                <th
                  key={col.name}
                  onClick={() => onSort(col.name)}
                  className={sortCol === col.name ? "sorted" : ""}
                >
                  {getLabel(col.name)}
                  <span style={{ marginLeft: 3, opacity: 0.5 }}>
                    {sortCol === col.name
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : "↕"}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {(() => {
            // Pre-compute which column keys are visible (data, annotation, lookup)
            // so cell rules targeting invisible columns can fall back to row styling
            const visibleColKeys = new Set(
              displayCols.flatMap((col) => {
                if (col.type === "data") return [col.name];
                if (col.type === "annotation") return [col.ac.id];
                if (col.type === "lookup") return [col.lc.id];
                return [];
              }),
            );
            return rows.map((row, ri) => {
              // Enrich row with annotation and lookup values so color rules can use them as condition columns
              let enrichedRow: Record<string, unknown> = row;
              if (colorRules.length && annotationColumns.length)
                enrichedRow = {
                  ...enrichedRow,
                  ...Object.fromEntries(
                    annotationColumns.map((ac) => [
                      ac.id,
                      annotationValues[`${row._row_id}:${ac.id}`] ?? "",
                    ]),
                  ),
                };
              if (colorRules.length && lookupColumns.length)
                enrichedRow = {
                  ...enrichedRow,
                  ...Object.fromEntries(
                    lookupColumns.map((lc, lcIdx) => [
                      lc.id,
                      lookupValues[ri]?.[lcIdx] ?? "",
                    ]),
                  ),
                };
              const { rowStyle: baseRowStyle, cellStyles } = colorRules.length
                ? evaluateColorRules(enrichedRow, colorRules)
                : { rowStyle: {}, cellStyles: {} };
              // Merge styles from cell rules whose targetColumn is not visible into rowStyle
              const rowStyle: Record<string, string> = {
                ...(baseRowStyle as Record<string, string>),
              };
              for (const [key, style] of Object.entries(cellStyles)) {
                if (!visibleColKeys.has(key)) Object.assign(rowStyle, style);
              }

              return (
                <tr
                  key={ri}
                  style={rowStyle as React.CSSProperties}
                  className={
                    (rowStyle as React.CSSProperties).backgroundColor
                      ? "colored-row"
                      : undefined
                  }
                >
                  {displayCols.map((col) => {
                    if (col.type === "formula") {
                      const val = formulaValues[ri]?.[col.fcIdx] ?? "";
                      return (
                        <td
                          key={`fc-${col.fc.id}`}
                          style={{
                            width: col.fc.width ?? 150,
                            fontFamily: "monospace",
                            color: val.startsWith("#ERR")
                              ? "var(--red)"
                              : "var(--purple)",
                          }}
                          title={val}
                        >
                          {val}
                        </td>
                      );
                    }

                    if (col.type === "lookup") {
                      const val = lookupValues[ri]?.[col.lcIdx] ?? "";
                      const isPending = !val;
                      const isFallback = val === col.lc.fallback;
                      const lcCellStyle = (cellStyles[col.lc.id] ||
                        {}) as React.CSSProperties;
                      const rowTextColorLc = (rowStyle as React.CSSProperties)
                        .color as string | undefined;
                      return (
                        <td
                          key={`lc-${col.lc.id}`}
                          style={{
                            width: col.lc.width ?? 220,
                            color: isPending
                              ? "var(--text-3)"
                              : isFallback
                                ? "var(--yellow)"
                                : rowTextColorLc || "var(--blue)",
                            fontStyle: isFallback ? "italic" : "normal",
                            ...lcCellStyle,
                          }}
                          title={val}
                        >
                          {val}
                        </td>
                      );
                    }

                    if (col.type === "template") {
                      const val = col.tc.template.replace(
                        /\{(\w+)\}/g,
                        (_, key) => String(row[key] ?? ""),
                      );
                      const rowId = String(row._row_id ?? ri);
                      const copyKey = `${rowId}:${col.tc.id}`;
                      return (
                        <td
                          key={`tc-${col.tc.id}`}
                          style={{
                            position: "relative",
                            width: col.tc.width ?? 280,
                            whiteSpace: "pre-wrap",
                            color:
                              ((rowStyle as React.CSSProperties)
                                .color as string) || "var(--text-1)",
                            fontSize: 11,
                            lineHeight: 1.4,
                            verticalAlign: "top",
                            padding: "24px 6px 6px",
                          }}
                          title={val}
                        >
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ position: "absolute", top: 4, right: 4 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyTemplateText(val, copyKey);
                            }}
                            title="Copiar mensagem"
                            aria-label="Copiar mensagem"
                          >
                            {copiedTemplateKey === copyKey ? "✓" : "📋"}
                          </button>
                          {val}
                        </td>
                      );
                    }

                    if (col.type === "annotation") {
                      const rowId = row._row_id as number;
                      const key = `${rowId}:${col.ac.id}`;
                      const saved = annotationValues[key] ?? "";
                      const acCellStyle = (cellStyles[col.ac.id] ||
                        {}) as React.CSSProperties;
                      return (
                        <td
                          key={`ac-${col.ac.id}`}
                          style={{
                            width: col.ac.width ?? 180,
                            padding: "2px 4px",
                            ...acCellStyle,
                          }}
                        >
                          <input
                            type="text"
                            defaultValue={saved}
                            key={saved}
                            onChange={(e) => {
                              pendingRef.current[key] = e.target.value;
                            }}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (val !== saved) {
                                onAnnotationChange(rowId, col.ac.id, val);
                              }
                              delete pendingRef.current[key];
                            }}
                            style={{
                              width: "100%",
                              background: "transparent",
                              border: "none",
                              borderBottom: "1px solid var(--border)",
                              color: "var(--text-1)",
                              fontSize: "inherit",
                              padding: "1px 2px",
                            }}
                          />
                        </td>
                      );
                    }

                    const cellStyle = (cellStyles[col.name] ||
                      {}) as React.CSSProperties;
                    const rowTextColor = (rowStyle as React.CSSProperties)
                      .color;
                    const mergedStyle: React.CSSProperties =
                      rowTextColor && !cellStyle.color
                        ? { ...cellStyle, color: rowTextColor }
                        : cellStyle;
                    const val = row[col.name] ?? "";
                    const colType = columns.find(
                      (c) => c.name === col.name,
                    )?.type;
                    const displayVal =
                      colType === "date"
                        ? formatDate(String(val))
                        : String(val);
                    return (
                      <td key={col.name} style={mergedStyle} title={displayVal}>
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}
