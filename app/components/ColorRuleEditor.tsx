'use client';

import type { ColorRule, ColorCondition, ColumnDef, AnnotationColumn, LookupColumn } from '@/lib/clientDb';
import { getOpsForType } from '@/lib/operators';

interface ColorRuleEditorProps {
  rules: ColorRule[];
  columns: ColumnDef[];
  annotationColumns?: AnnotationColumn[];
  lookupColumns?: LookupColumn[];
  onChange: (rules: ColorRule[]) => void;
}

function createRule(priority: number, defaultColumn: string): ColorRule {
  return {
    id: Date.now().toString() + Math.random(),
    name: `Regra ${priority + 1}`,
    targetType: 'row',
    conditions: [{ conditionColumn: defaultColumn, operator: 'equals', value: '' }],
    backgroundColor: '#3fb950',
    priority,
  };
}

function normalizeConditions(rule: ColorRule): ColorCondition[] {
  if (rule.conditions?.length) return rule.conditions;
  return [{
    conditionColumn: rule.conditionColumn ?? '',
    operator: rule.operator ?? 'equals',
    value: rule.value ?? '',
    value2: rule.value2,
  }];
}

const NO_VALUE_OPS = ['is_null','is_not_null','is_today','is_yesterday','is_day_before_yesterday','is_tomorrow','is_today_or_tomorrow','is_future','is_future_or_today','is_past','is_past_or_today'];
const DAYS_OFFSET_OPS = ['days_ahead_gte','days_ahead_lte','days_ago_gte','days_ago_lte'];

export default function ColorRuleEditor({ rules, columns, annotationColumns = [], lookupColumns = [], onChange }: ColorRuleEditorProps) {
  const updateRule = (i: number, field: string, val: unknown) => {
    const next = [...rules];
    (next[i] as unknown as Record<string, unknown>)[field] = val;
    onChange(next);
  };

  const updateCondition = (ruleIdx: number, condIdx: number, field: string, val: unknown) => {
    const next = [...rules];
    const conds = [...normalizeConditions(next[ruleIdx])];
    (conds[condIdx] as unknown as Record<string, unknown>)[field] = val;
    next[ruleIdx] = { ...next[ruleIdx], conditions: conds, conditionColumn: undefined, operator: undefined, value: undefined, value2: undefined };
    onChange(next);
  };

  const addCondition = (ruleIdx: number) => {
    const next = [...rules];
    const conds = [...normalizeConditions(next[ruleIdx]), { conditionColumn: columns[0]?.name ?? '', operator: 'equals', value: '' }];
    next[ruleIdx] = { ...next[ruleIdx], conditions: conds };
    onChange(next);
  };

  const removeCondition = (ruleIdx: number, condIdx: number) => {
    const next = [...rules];
    const conds = normalizeConditions(next[ruleIdx]).filter((_, j) => j !== condIdx);
    next[ruleIdx] = { ...next[ruleIdx], conditions: conds };
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

  const columnOptions = (
    <>
      {columns.map(c => (
        <option key={c.name} value={c.name}>{c.label}</option>
      ))}
      {annotationColumns.length > 0 && (
        <optgroup label="Anotações">
          {annotationColumns.map(ac => (
            <option key={ac.id} value={ac.id}>{ac.label}</option>
          ))}
        </optgroup>
      )}
      {lookupColumns.length > 0 && (
        <optgroup label="Lookup">
          {lookupColumns.map(lc => (
            <option key={lc.id} value={lc.id}>{lc.label}</option>
          ))}
        </optgroup>
      )}
    </>
  );

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
        const conds = normalizeConditions(rule);
        return (
          <div key={rule.id} className="rule-card">
            <div className="rule-card-header">
              <input
                className="rule-name-input"
                value={rule.name}
                onChange={e => updateRule(i, 'name', e.target.value)}
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
                  onChange={e => updateRule(i, 'targetType', e.target.value)}
                >
                  <option value="row">Linha inteira</option>
                  <option value="cell">Célula específica</option>
                </select>
                {rule.targetType === 'cell' && (
                  <select
                    value={rule.targetColumn || ''}
                    onChange={e => updateRule(i, 'targetColumn', e.target.value || undefined)}
                  >
                    <option value="">— Selecionar coluna —</option>
                    {columnOptions}
                  </select>
                )}
              </div>

              {/* Conditions (AND) */}
              <div className="rule-conditions">
                {conds.map((cond, ci) => {
                  const condCol = columns.find(c => c.name === cond.conditionColumn);
                  const isAnnotationCond = annotationColumns.some(ac => ac.id === cond.conditionColumn);
                  const ops = getOpsForType(isAnnotationCond ? 'text' : (condCol?.type ?? 'text'));
                  const isBetween = cond.operator === 'between' || cond.operator === 'date_between';
                  const isDaysOffset = DAYS_OFFSET_OPS.includes(cond.operator);
                  const noValue = NO_VALUE_OPS.includes(cond.operator);
                  return (
                    <div key={ci} className="rule-row" style={{ alignItems: 'center' }}>
                      <label style={{ minWidth: 20, color: 'var(--text-3)', fontSize: 11, textAlign: 'right' }}>
                        {ci === 0 ? 'Se' : 'E'}
                      </label>
                      <select
                        value={cond.conditionColumn}
                        onChange={e => updateCondition(i, ci, 'conditionColumn', e.target.value)}
                      >
                        {columnOptions}
                      </select>
                      <select
                        value={cond.operator}
                        onChange={e => updateCondition(i, ci, 'operator', e.target.value)}
                      >
                        {ops.map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                      {!noValue && (
                        <input
                          type={isDaysOffset ? 'number' : condCol?.type === 'date' ? 'date' : 'text'}
                          placeholder={isDaysOffset ? 'Nº de dias' : cond.operator === 'in' || cond.operator === 'not_in' ? 'val1,val2' : 'Valor'}
                          min={isDaysOffset ? '0' : undefined}
                          value={cond.value}
                          onChange={e => updateCondition(i, ci, 'value', e.target.value)}
                          className="rule-value-input"
                        />
                      )}
                      {isBetween && (
                        <input
                          type={condCol?.type === 'date' ? 'date' : 'text'}
                          placeholder="Até"
                          value={cond.value2 || ''}
                          onChange={e => updateCondition(i, ci, 'value2', e.target.value)}
                          className="rule-value-input"
                          style={{ maxWidth: 90 }}
                        />
                      )}
                      {conds.length > 1 && (
                        <button
                          className="btn btn-sm btn-icon btn-ghost"
                          onClick={() => removeCondition(i, ci)}
                          title="Remover condição"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => addCondition(i)}
                  style={{ marginTop: 4, fontSize: 12 }}
                >
                  + Condição (E)
                </button>
              </div>

              {/* Colors */}
              <div className="rule-row">
                <label>Cores</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="color"
                      value={rule.backgroundColor}
                      onChange={e => updateRule(i, 'backgroundColor', e.target.value)}
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
                        updateRule(i, 'textColor', e.target.checked ? '#ffffff' : undefined)
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
                        onChange={e => updateRule(i, 'textColor', e.target.value)}
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
