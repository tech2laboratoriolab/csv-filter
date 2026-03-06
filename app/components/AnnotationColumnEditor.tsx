'use client';

import { useState } from 'react';
import type { AnnotationColumn, ColumnDef } from '@/lib/types';

interface AnnotationColumnEditorProps {
  annotationColumns: AnnotationColumn[];
  columns: ColumnDef[];
  selectedCols: string[];
  onChange: (cols: AnnotationColumn[]) => void;
}

export default function AnnotationColumnEditor({
  annotationColumns,
  columns,
  selectedCols,
  onChange,
}: AnnotationColumnEditorProps) {
  const update = (i: number, field: string, val: unknown) => {
    const next = [...annotationColumns];
    (next[i] as unknown as Record<string, unknown>)[field] = val;
    onChange(next);
  };

  const remove = (i: number) => onChange(annotationColumns.filter((_, j) => j !== i));

  const addAnnotation = () => {
    onChange([
      ...annotationColumns,
      {
        id: Date.now().toString() + Math.random(),
        label: `Anotação ${annotationColumns.length + 1}`,
        width: 180,
      },
    ]);
  };

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
        <strong style={{ color: 'var(--text-2)' }}>Colunas de anotação</strong> permitem digitar
        texto livremente em cada linha. Os valores são salvos automaticamente no banco de dados.
      </div>

      {annotationColumns.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            color: 'var(--text-3)',
            fontSize: 13,
          }}
        >
          Sem colunas de anotação.
        </div>
      )}

      {annotationColumns.map((ac, i) => (
        <div key={ac.id} className="rule-card">
          <div className="rule-card-header">
            <input
              className="rule-name-input"
              value={ac.label}
              onChange={e => update(i, 'label', e.target.value)}
              placeholder="Label da coluna"
            />
            <button className="btn btn-sm btn-icon btn-red" onClick={() => remove(i)}>
              ✕
            </button>
          </div>
          <div className="rule-card-body">
            <div className="rule-row">
              <label>Após col.</label>
              <select
                value={ac.insertAfterColumn || ''}
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
                value={ac.width ?? 180}
                onChange={e => update(i, 'width', parseInt(e.target.value) || 180)}
                style={{ width: 70 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>px</span>
            </div>
          </div>
        </div>
      ))}

      <button className="btn btn-blue btn-sm" style={{ marginTop: 8 }} onClick={addAnnotation}>
        + Nova Anotação
      </button>
    </div>
  );
}
