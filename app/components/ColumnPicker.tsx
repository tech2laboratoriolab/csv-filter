'use client';

import { useState } from 'react';
import type { ColumnDef } from '@/lib/clientDb';

interface ColumnPickerProps {
  columns: ColumnDef[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function ColumnPicker({ columns, selected, onChange }: ColumnPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? columns.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : columns;

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter(c => c !== name) : [...selected, name]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <button className="link-btn" onClick={() => onChange(columns.map(c => c.name))}>
          Todas
        </button>
        <button className="link-btn" onClick={() => onChange([])}>
          Nenhuma
        </button>
        <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 'auto' }}>
          {selected.length}/{columns.length} selecionadas
        </span>
      </div>
      <input
        className="col-search"
        placeholder="Buscar coluna..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="col-list" style={{ maxHeight: 360 }}>
        {filtered.map(c => (
          <div
            key={c.name}
            className={`col-item ${selected.includes(c.name) ? 'on' : ''}`}
            onClick={() => toggle(c.name)}
          >
            <div className="col-check">{selected.includes(c.name) && '✓'}</div>
            <span>{c.label}</span>
            <span className="col-type">
              {c.type === 'number' ? 'NUM' : c.type === 'date' ? 'DATA' : 'TXT'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
