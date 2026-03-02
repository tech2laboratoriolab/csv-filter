'use client';

import type { ColorRule, ColumnDef } from '@/lib/types';
import { getOpsForType } from '@/lib/operators';

interface ColorRuleEditorProps {
  rules: ColorRule[];
  columns: ColumnDef[];
  onChange: (rules: ColorRule[]) => void;
}

function createRule(priority: number, defaultColumn: string): ColorRule {
  return {
    id: Date.now().toString() + Math.random(),
    name: `Regra ${priority + 1}`,
    targetType: 'row',
    conditionColumn: defaultColumn,
    operator: 'equals',
    value: '',
    backgroundColor: '#3fb950',
    priority,
  };
}

export default function ColorRuleEditor({ rules, columns, onChange }: ColorRuleEditorProps) {
  const update = (i: number, field: string, val: unknown) => {
    const next = [...rules];
    (next[i] as unknown as Record<string, unknown>)[field] = val;
    onChange(next);
  };

  const remove = (i: number) => onChange(rules.filter((_, j) => j !== i));

  const movePriority = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j], next[i]];
    next.forEach((r, idx) => (r.priority = idx));
    onChange(next);
  };

  const addRule = () => {
    const col = columns[0]?.name ?? '';
    onChange([...rules, createRule(rules.length, col)]);
  };

  return (
    <div>
      {rules.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            color: 'var(--text-3)',
            fontSize: 13,
          }}
        >
          Sem regras de cor. Clique em &ldquo;+ Nova Regra&rdquo; para adicionar.
        </div>
      )}
      {rules.map((rule, i) => {
        const condCol = columns.find(c => c.name === rule.conditionColumn);
        const ops = getOpsForType(condCol?.type ?? 'text');
        const isBetween = rule.operator === 'between' || rule.operator === 'date_between';
        return (
          <div key={rule.id} className="rule-card">
            <div className="rule-card-header">
              <input
                className="rule-name-input"
                value={rule.name}
                onChange={e => update(i, 'name', e.target.value)}
                placeholder="Nome da regra"
              />
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  className="btn btn-sm btn-icon btn-ghost"
                  onClick={() => movePriority(i, -1)}
                  title="Mover para cima (maior prioridade)"
                >
                  ↑
                </button>
                <button
                  className="btn btn-sm btn-icon btn-ghost"
                  onClick={() => movePriority(i, 1)}
                  title="Mover para baixo"
                >
                  ↓
                </button>
                <button className="btn btn-sm btn-icon btn-red" onClick={() => remove(i)}>
                  ✕
                </button>
              </div>
            </div>
            <div className="rule-card-body">
              {/* Target */}
              <div className="rule-row">
                <label>Alvo</label>
                <select
                  value={rule.targetType}
                  onChange={e => update(i, 'targetType', e.target.value)}
                >
                  <option value="row">Linha inteira</option>
                  <option value="cell">Célula específica</option>
                </select>
                {rule.targetType === 'cell' && (
                  <select
                    value={rule.targetColumn || ''}
                    onChange={e => update(i, 'targetColumn', e.target.value || undefined)}
                  >
                    <option value="">— Selecionar coluna —</option>
                    {columns.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Condition */}
              <div className="rule-row">
                <label>Condição</label>
                <select
                  value={rule.conditionColumn}
                  onChange={e => update(i, 'conditionColumn', e.target.value)}
                >
                  {columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={e => update(i, 'operator', e.target.value)}
                >
                  {ops.map(o => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
                {rule.operator !== 'is_null' && rule.operator !== 'is_not_null' &&
                  rule.operator !== 'is_today' && rule.operator !== 'is_future' && rule.operator !== 'is_past' && (
                  <input
                    type={condCol?.type === 'date' ? 'date' : 'text'}
                    placeholder={rule.operator === 'in' || rule.operator === 'not_in' ? 'val1,val2' : 'Valor'}
                    value={rule.value}
                    onChange={e => update(i, 'value', e.target.value)}
                    className="rule-value-input"
                  />
                )}
                {isBetween && (
                  <input
                    type={condCol?.type === 'date' ? 'date' : 'text'}
                    placeholder="Até"
                    value={rule.value2 || ''}
                    onChange={e => update(i, 'value2', e.target.value)}
                    className="rule-value-input"
                    style={{ maxWidth: 90 }}
                  />
                )}
              </div>

              {/* Colors */}
              <div className="rule-row">
                <label>Cores</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="color"
                      value={rule.backgroundColor}
                      onChange={e => update(i, 'backgroundColor', e.target.value)}
                      title="Cor de fundo"
                      className="color-picker"
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Fundo</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!rule.textColor}
                      onChange={e =>
                        update(i, 'textColor', e.target.checked ? '#ffffff' : undefined)
                      }
                      id={`tc-${rule.id}`}
                    />
                    <label
                      htmlFor={`tc-${rule.id}`}
                      style={{ fontSize: 11, color: 'var(--text-3)', cursor: 'pointer' }}
                    >
                      Texto
                    </label>
                    {rule.textColor && (
                      <input
                        type="color"
                        value={rule.textColor}
                        onChange={e => update(i, 'textColor', e.target.value)}
                        className="color-picker"
                      />
                    )}
                  </div>
                  <div
                    style={{
                      width: 80,
                      height: 20,
                      background: rule.backgroundColor,
                      color: rule.textColor,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      border: '1px solid var(--border)',
                    }}
                  >
                    Prévia
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Prioridade {rule.priority} — regras com número menor são aplicadas por último (vencem)
              </div>
            </div>
          </div>
        );
      })}
      <button className="btn btn-blue btn-sm" style={{ marginTop: 8 }} onClick={addRule}>
        + Nova Regra
      </button>
    </div>
  );
}
