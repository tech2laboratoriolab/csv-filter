'use client';

import type { ColumnDef, ColorRule, FormulaColumn } from '@/lib/types';
import { evaluateColorRules } from '@/lib/colorRules';

interface DataTableProps {
  rows: Record<string, unknown>[];
  selectedCols: string[];
  columns: ColumnDef[];
  colorRules: ColorRule[];
  formulaColumns: FormulaColumn[];
  formulaValues: string[][];
  sortCol?: string;
  sortDir: 'asc' | 'desc';
  onSort: (col: string) => void;
}

type DisplayCol =
  | { type: 'data'; name: string }
  | { type: 'formula'; fc: FormulaColumn; fcIdx: number };

function buildDisplayCols(selectedCols: string[], formulaColumns: FormulaColumn[]): DisplayCol[] {
  const result: DisplayCol[] = [];

  for (const name of selectedCols) {
    result.push({ type: 'data', name });
    // Insert formula columns that specify insertAfterColumn === this column
    formulaColumns.forEach((fc, fcIdx) => {
      if (fc.insertAfterColumn === name) {
        result.push({ type: 'formula', fc, fcIdx });
      }
    });
  }

  // Append formula columns with no insertAfterColumn at the end
  formulaColumns.forEach((fc, fcIdx) => {
    if (!fc.insertAfterColumn) {
      result.push({ type: 'formula', fc, fcIdx });
    }
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
  sortCol,
  sortDir,
  onSort,
}: DataTableProps) {
  const getLabel = (name: string) => columns.find(c => c.name === name)?.label ?? name;
  const displayCols = buildDisplayCols(selectedCols, formulaColumns);

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
            const { rowStyle, cellStyles } = colorRules.length
              ? evaluateColorRules(row, colorRules)
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
