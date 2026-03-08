'use client';

import { useState } from 'react';
import type { FormulaColumn, ColumnDef } from '@/lib/clientDb';

interface FormulaColumnEditorProps {
  formulaColumns: FormulaColumn[];
  columns: ColumnDef[];
  selectedCols: string[];
  sampleRow?: Record<string, unknown>;
  onChange: (cols: FormulaColumn[]) => void;
}

function colLetter(idx: number): string {
  let result = '';
  let n = idx;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

export default function FormulaColumnEditor({
  formulaColumns,
  columns,
  selectedCols,
  sampleRow,
  onChange,
}: FormulaColumnEditorProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});

  const update = (i: number, field: string, val: unknown) => {
    const next = [...formulaColumns];
    (next[i] as unknown as Record<string, unknown>)[field] = val;
    onChange(next);
  };

  const remove = (i: number) => onChange(formulaColumns.filter((_, j) => j !== i));

  const addFormula = () => {
    onChange([
      ...formulaColumns,
      {
        id: Date.now().toString() + Math.random(),
        label: `Fórmula ${formulaColumns.length + 1}`,
        formula: '=A1',
        width: 150,
      },
    ]);
  };

  const handleFormulaBlur = async (fc: FormulaColumn) => {
    if (!sampleRow || !fc.formula.startsWith('=')) {
      setPreviews(p => ({ ...p, [fc.id]: '' }));
      return;
    }
    setPreviewLoading(p => ({ ...p, [fc.id]: true }));
    try {
      const { evaluateSingleFormula } = await import('@/lib/formulaEngine');
      const colNames = columns.map(c => c.name);
      const result = await evaluateSingleFormula(fc.formula, sampleRow, colNames);
      setPreviews(p => ({ ...p, [fc.id]: result }));
    } catch {
      setPreviews(p => ({ ...p, [fc.id]: '#ERR' }));
    } finally {
      setPreviewLoading(p => ({ ...p, [fc.id]: false }));
    }
  };

  // Build column letter reference for the help box (show first 8)
  const colRef = columns
    .slice(0, 8)
    .map((c, i) => `${colLetter(i)}=${c.label}`)
    .join(', ');

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          marginBottom: 12,
          padding: '8px 10px',
          background: 'var(--bg-2)',
          borderRadius: 4,
          lineHeight: 1.6,
          border: '1px solid var(--border)',
        }}
      >
        <strong style={{ color: 'var(--text-2)' }}>Referência de colunas:</strong> {colRef}
        {columns.length > 8 ? `, ... (${columns.length} total)` : ''}
        <br />
        <strong style={{ color: 'var(--text-2)' }}>Funções:</strong> SE, SEERRO, ÉCÉL.VAZIA,
        PROCV, SOMA, VALOR, CONCATENAR, &amp; (concatenar)
        <br />
        <strong style={{ color: 'var(--text-2)' }}>Separador:</strong> ponto-e-vírgula (
        <code style={{ color: 'var(--green)' }}>=SE(A1&gt;0;&quot;Sim&quot;;&quot;Não&quot;)</code>
        )
      </div>

      {formulaColumns.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            color: 'var(--text-3)',
            fontSize: 13,
          }}
        >
          Sem colunas de fórmula.
        </div>
      )}

      {formulaColumns.map((fc, i) => (
        <div key={fc.id} className="rule-card">
          <div className="rule-card-header">
            <input
              className="rule-name-input"
              value={fc.label}
              onChange={e => update(i, 'label', e.target.value)}
              placeholder="Label da coluna"
            />
            <button className="btn btn-sm btn-icon btn-red" onClick={() => remove(i)}>
              ✕
            </button>
          </div>
          <div className="rule-card-body">
            <div className="rule-row">
              <label>Fórmula</label>
              <input
                className="formula-input"
                value={fc.formula}
                onChange={e => update(i, 'formula', e.target.value)}
                onBlur={() => handleFormulaBlur(fc)}
                placeholder='=SE(A1>0;"Sim";"Não")'
                spellCheck={false}
              />
            </div>

            <div className="rule-row">
              <label>Após col.</label>
              <select
                value={fc.insertAfterColumn || ''}
                onChange={e => update(i, 'insertAfterColumn', e.target.value || undefined)}
              >
                <option value="">— No final —</option>
                {selectedCols.map(name => {
                  const col = columns.find(c => c.name === name);
                  return (
                    <option key={name} value={name}>
                      {col?.label ?? name}
                    </option>
                  );
                })}
              </select>
              <label style={{ marginLeft: 8 }}>Largura</label>
              <input
                type="number"
                value={fc.width ?? 150}
                onChange={e => update(i, 'width', parseInt(e.target.value) || 150)}
                style={{ width: 70 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>px</span>
            </div>

            <div className="rule-row">
              <label>Preview</label>
              <span
                style={{
                  fontSize: 12,
                  color: previewLoading[fc.id]
                    ? 'var(--text-3)'
                    : previews[fc.id]?.startsWith('#ERR')
                      ? 'var(--red)'
                      : 'var(--green)',
                  fontFamily: 'monospace',
                  background: 'var(--bg-3)',
                  padding: '2px 8px',
                  borderRadius: 3,
                  minWidth: 60,
                  display: 'inline-block',
                }}
              >
                {previewLoading[fc.id] ? '...' : (previews[fc.id] ?? '—')}
              </span>
              {!previewLoading[fc.id] && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  (clique fora da fórmula para atualizar)
                </span>
              )}
            </div>
          </div>
        </div>
      ))}

      <button className="btn btn-blue btn-sm" style={{ marginTop: 8 }} onClick={addFormula}>
        + Nova Fórmula
      </button>
    </div>
  );
}
