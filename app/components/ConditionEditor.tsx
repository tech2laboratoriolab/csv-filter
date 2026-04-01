'use client';

import { useState, useEffect, useRef } from 'react';
import type { ColumnDef, FilterCondition } from '@/lib/clientDb';
import { getOpsForType } from '@/lib/operators';
import { getDistinctValues } from '@/lib/clientDb';

// Columns that render a select dropdown instead of a free-text input
const SELECT_COLUMNS = new Set<string>();

interface ConditionEditorProps {
  columns: ColumnDef[];
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  onApply: () => void;
  loading?: boolean;
}

function makeOrGroupId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function ConditionEditor({
  columns,
  conditions,
  onChange,
  onApply,
  loading,
}: ConditionEditorProps) {
  const [distinctValues, setDistinctValues] = useState<Record<string, string[]>>({});
  const fetchedCols = useRef<Set<string>>(new Set());

  // Fetch distinct values whenever a SELECT_COLUMNS column appears in conditions
  useEffect(() => {
    const needed = Array.from(new Set(conditions.map(c => c.column))).filter(
      col => SELECT_COLUMNS.has(col) && !fetchedCols.current.has(col),
    );
    for (const col of needed) {
      fetchedCols.current.add(col);
      getDistinctValues(col)
        .then(values => {
          if (values) setDistinctValues(prev => ({ ...prev, [col]: values }));
        })
        .catch(() => fetchedCols.current.delete(col));
    }
  }, [conditions]);

  const addCondition = () => {
    if (!columns.length) return;
    onChange([...conditions, { column: columns[0].name, operator: 'equals', value: '' }]);
  };

  const updateCond = (i: number, field: string, val: string) => {
    const next = [...conditions];
    (next[i] as unknown as Record<string, string>)[field] = val;
    if (field === 'column') {
      next[i].operator = 'equals';
      next[i].value = '';
      delete next[i].value2;
    }
    onChange(next);
  };

  const removeCond = (i: number) => {
    const cond = conditions[i];
    const next = conditions.filter((_, j) => j !== i);
    // If removing leaves a group with only 1 member, clear that group
    if (cond.orGroup) {
      const remaining = next.filter(c => c.orGroup === cond.orGroup);
      if (remaining.length === 1) {
        remaining[0].orGroup = undefined;
      }
    }
    onChange(next);
  };

  const addOrCondition = (i: number) => {
    const next = [...conditions];
    const existing = next[i].orGroup;
    const groupId = existing ?? makeOrGroupId();
    if (!existing) {
      next[i] = { ...next[i], orGroup: groupId };
    }
    const newCond: FilterCondition = {
      column: columns[0]?.name ?? '',
      operator: 'equals',
      value: '',
      orGroup: groupId,
    };
    next.splice(i + 1, 0, newCond);
    onChange(next);
  };

  const getOps = (colName: string) => {
    const col = columns.find(c => c.name === colName);
    const ops = getOpsForType(col?.type ?? 'text');
    if (/id/i.test(colName) && !ops.some(o => o.v === 'in')) {
      return [...ops, { v: 'in', l: 'Em (lista)' }, { v: 'not_in', l: 'Não em (lista)' }];
    }
    return ops;
  };

  const isDate = (colName: string) =>
    columns.find(c => c.name === colName)?.type === 'date';

  const noValue = (op: string) =>
    op === 'is_null' || op === 'is_not_null' ||
    op === 'is_today' || op === 'is_yesterday' || op === 'is_day_before_yesterday' ||
    op === 'is_tomorrow' || op === 'is_today_or_tomorrow' || op === 'is_future' || op === 'is_future_or_today' ||
    op === 'is_past' || op === 'is_past_or_today' || op === 'unique_combination';
  const isList = (op: string) => op === 'in' || op === 'not_in';

  return (
    <div>
      {conditions.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            color: 'var(--text-3)',
            fontSize: 13,
          }}
        >
          Sem filtros ativos
        </div>
      )}
      {conditions.map((c, i) => {
        const prevCond = i > 0 ? conditions[i - 1] : null;
        const isPartOfGroup = !!c.orGroup;
        const isNotFirstInGroup = isPartOfGroup && prevCond?.orGroup === c.orGroup;

        return (
          <div key={i}>
            {isNotFirstInGroup && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  margin: '2px 0',
                  letterSpacing: 1,
                }}
              >
                OU
              </div>
            )}
            <div
              className="filter-card"
              style={
                isPartOfGroup
                  ? { borderLeft: '3px solid var(--accent)', marginLeft: 4 }
                  : undefined
              }
            >
              <div className="filter-row">
                <select value={c.column} onChange={e => updateCond(i, 'column', e.target.value)}>
                  {columns.map(col => (
                    <option key={col.name} value={col.name}>
                      {col.label}
                    </option>
                  ))}
                </select>
                <select value={c.operator} onChange={e => updateCond(i, 'operator', e.target.value)}>
                  {getOps(c.column).map(o => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
                {!noValue(c.operator) && (
                  SELECT_COLUMNS.has(c.column) && !isList(c.operator) && !isDate(c.column) && distinctValues[c.column] ? (
                    <select value={c.value} onChange={e => updateCond(i, 'value', e.target.value)}>
                      <option value="">-- Selecione --</option>
                      {distinctValues[c.column].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={isDate(c.column) ? 'date' : 'text'}
                      placeholder={isList(c.operator) ? 'val1,val2,val3' : 'Valor'}
                      value={c.value}
                      onChange={e => updateCond(i, 'value', e.target.value)}
                    />
                  )
                )}
                {(c.operator === 'between' || c.operator === 'date_between') && (
                  <input
                    type={isDate(c.column) ? 'date' : 'text'}
                    placeholder="Até"
                    value={c.value2 || ''}
                    onChange={e => updateCond(i, 'value2', e.target.value)}
                    style={{ maxWidth: 90 }}
                  />
                )}
                <button
                  className="btn btn-sm"
                  title="Adicionar condição OR"
                  onClick={() => addOrCondition(i)}
                  style={{ fontSize: 11, padding: '2px 6px', opacity: 0.7 }}
                >
                  ＋OU
                </button>
                <button className="btn btn-sm btn-icon btn-red" onClick={() => removeCond(i)}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="btn-group" style={{ marginTop: 12 }}>
        <button className="btn btn-sm btn-blue" onClick={addCondition}>
          + Condição
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={onApply}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          {loading ? <span className="spinner" /> : '🔍'} Aplicar
        </button>
      </div>
      {conditions.length > 0 && (
        <button
          className="link-btn"
          style={{ marginTop: 6, display: 'block', width: '100%', textAlign: 'center' }}
          onClick={() => onChange([])}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
