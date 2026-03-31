'use client';

import { useRef } from 'react';
import type { ColumnDef, ColorRule, FormulaColumn, AnnotationColumn, LookupColumn } from '@/lib/clientDb';
import { evaluateColorRules } from '@/lib/colorRules';

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
  onAnnotationChange: (rowId: number, colId: string, value: string) => void;
  sortCol?: string;
  sortDir: 'asc' | 'desc';
  onSort: (col: string) => void;
}

type DisplayCol =
  | { type: 'data'; name: string }
  | { type: 'formula'; fc: FormulaColumn; fcIdx: number }
  | { type: 'annotation'; ac: AnnotationColumn; acIdx: number }
  | { type: 'lookup'; lc: LookupColumn; lcIdx: number };

function buildDisplayCols(
  selectedCols: string[],
  formulaColumns: FormulaColumn[],
  annotationColumns: AnnotationColumn[],
  lookupColumns: LookupColumn[] = [],
): DisplayCol[] {
  const result: DisplayCol[] = [];

  for (const name of selectedCols) {
    result.push({ type: 'data', name });
    formulaColumns.forEach((fc, fcIdx) => {
      if (fc.insertAfterColumn === name) result.push({ type: 'formula', fc, fcIdx });
    });
    annotationColumns.forEach((ac, acIdx) => {
      if (ac.insertAfterColumn === name) result.push({ type: 'annotation', ac, acIdx });
    });
    lookupColumns.forEach((lc, lcIdx) => {
      if (lc.insertAfterColumn === name) result.push({ type: 'lookup', lc, lcIdx });
    });
  }

  formulaColumns.forEach((fc, fcIdx) => {
    if (!fc.insertAfterColumn || !selectedCols.includes(fc.insertAfterColumn)) result.push({ type: 'formula', fc, fcIdx });
  });
  annotationColumns.forEach((ac, acIdx) => {
    if (!ac.insertAfterColumn || !selectedCols.includes(ac.insertAfterColumn)) result.push({ type: 'annotation', ac, acIdx });
  });
  lookupColumns.forEach((lc, lcIdx) => {
    if (!lc.insertAfterColumn || !selectedCols.includes(lc.insertAfterColumn)) result.push({ type: 'lookup', lc, lcIdx });
  });

  return result;
}

function formatDate(val: string): string {
  if (!val) return '';
  const [datePart, timePart] = val.split(' ');
  const parts = datePart.split('-');
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
  onAnnotationChange,
  sortCol,
  sortDir,
  onSort,
}: DataTableProps) {
  const getLabel = (name: string) => columns.find(c => c.name === name)?.label ?? name;
  const displayCols = buildDisplayCols(selectedCols, formulaColumns, annotationColumns, lookupColumns);
  // Track pending (uncommitted) edits keyed by "rowId:colId"
  const pendingRef = useRef<Record<string, string>>({});

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
            {displayCols.map(col => {
              if (col.type === 'formula') {
                return (
                  <th
                    key={`fc-${col.fc.id}`}
                    style={{ width: col.fc.width ?? 150, color: 'var(--purple)' }}
                  >
                    ƒ {col.fc.label}
                  </th>
                );
              }
              if (col.type === 'annotation') {
                return (
                  <th
                    key={`ac-${col.ac.id}`}
                    style={{ width: col.ac.width ?? 180, color: 'var(--green)' }}
                  >
                    ✏ {col.ac.label}
                  </th>
                );
              }
              if (col.type === 'lookup') {
                return (
                  <th
                    key={`lc-${col.lc.id}`}
                    style={{ width: col.lc.width ?? 220, color: 'var(--blue)' }}
                  >
                    ⌗ {col.lc.label}
                  </th>
                );
              }
              return (
                <th
                  key={col.name}
                  onClick={() => onSort(col.name)}
                  className={sortCol === col.name ? 'sorted' : ''}
                >
                  {getLabel(col.name)}
                  <span style={{ marginLeft: 3, opacity: 0.5 }}>
                    {sortCol === col.name ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            // Enrich row with annotation and lookup values so color rules can use them as condition columns
            let enrichedRow: Record<string, unknown> = row;
            if (colorRules.length && annotationColumns.length)
              enrichedRow = { ...enrichedRow, ...Object.fromEntries(annotationColumns.map(ac => [ac.id, annotationValues[`${row._row_id}:${ac.id}`] ?? ''])) };
            if (colorRules.length && lookupColumns.length)
              enrichedRow = { ...enrichedRow, ...Object.fromEntries(lookupColumns.map((lc, lcIdx) => [lc.id, lookupValues[ri]?.[lcIdx] ?? ''])) };
            const { rowStyle, cellStyles } = colorRules.length
              ? evaluateColorRules(enrichedRow, colorRules)
              : { rowStyle: {}, cellStyles: {} };

            return (
              <tr key={ri} style={rowStyle as React.CSSProperties}>
                {displayCols.map(col => {
                  if (col.type === 'formula') {
                    const val = formulaValues[ri]?.[col.fcIdx] ?? '';
                    return (
                      <td
                        key={`fc-${col.fc.id}`}
                        style={{
                          width: col.fc.width ?? 150,
                          fontFamily: 'monospace',
                          color: val.startsWith('#ERR') ? 'var(--red)' : 'var(--purple)',
                        }}
                        title={val}
                      >
                        {val}
                      </td>
                    );
                  }

                  if (col.type === 'lookup') {
                    const val = lookupValues[ri]?.[col.lcIdx] ?? '';
                    const isPending = !val;
                    const isFallback = val === col.lc.fallback;
                    const lcCellStyle = (cellStyles[col.lc.id] || {}) as React.CSSProperties;
                    return (
                      <td
                        key={`lc-${col.lc.id}`}
                        style={{
                          width: col.lc.width ?? 220,
                          color: isPending ? 'var(--text-3)' : isFallback ? 'var(--yellow)' : 'var(--blue)',
                          fontStyle: isFallback ? 'italic' : 'normal',
                          ...lcCellStyle,
                        }}
                        title={val}
                      >
                        {val}
                      </td>
                    );
                  }

                  if (col.type === 'annotation') {
                    const rowId = row._row_id as number;
                    const key = `${rowId}:${col.ac.id}`;
                    const saved = annotationValues[key] ?? '';
                    const acCellStyle = (cellStyles[col.ac.id] || {}) as React.CSSProperties;
                    return (
                      <td key={`ac-${col.ac.id}`} style={{ width: col.ac.width ?? 180, padding: '2px 4px', ...acCellStyle }}>
                        <input
                          type="text"
                          defaultValue={saved}
                          key={saved}
                          onChange={e => { pendingRef.current[key] = e.target.value; }}
                          onBlur={e => {
                            const val = e.target.value;
                            if (val !== saved) {
                              onAnnotationChange(rowId, col.ac.id, val);
                            }
                            delete pendingRef.current[key];
                          }}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--border)',
                            color: 'var(--text-1)',
                            fontSize: 'inherit',
                            padding: '1px 2px',
                          }}
                        />
                      </td>
                    );
                  }

                  const cellStyle = (cellStyles[col.name] || {}) as React.CSSProperties;
                  const val = row[col.name] ?? '';
                  const colType = columns.find(c => c.name === col.name)?.type;
                  const displayVal =
                    colType === 'date'
                      ? formatDate(String(val))
                      : String(val);
                  return (
                    <td key={col.name} style={cellStyle} title={displayVal}>
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
  );
}
