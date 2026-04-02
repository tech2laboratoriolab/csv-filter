import type { ColorRule } from './clientDb';

type StyleObj = Record<string, string>;

export interface ColorRuleResult {
  rowStyle: StyleObj;
  cellStyles: Record<string, StyleObj>;
}

function matchesRule(row: Record<string, unknown>, rule: ColorRule): boolean {
  const rawValue = row[rule.conditionColumn];
  const value = rawValue == null ? '' : String(rawValue);
  const ruleVal = rule.value || '';
  const ruleVal2 = rule.value2 || '';

  switch (rule.operator) {
    case 'equals':
      return value === ruleVal;
    case 'not_equals':
      return value !== ruleVal;
    case 'contains':
      return value.toLowerCase().includes(ruleVal.toLowerCase());
    case 'not_contains':
      return !value.toLowerCase().includes(ruleVal.toLowerCase());
    case 'gt':
      return parseFloat(value) > parseFloat(ruleVal);
    case 'gte':
      return parseFloat(value) >= parseFloat(ruleVal);
    case 'lt':
      return parseFloat(value) < parseFloat(ruleVal);
    case 'lte':
      return parseFloat(value) <= parseFloat(ruleVal);
    case 'between': {
      const v = parseFloat(value);
      return v >= parseFloat(ruleVal) && v <= parseFloat(ruleVal2);
    }
    case 'in':
      return ruleVal.split(',').map(s => s.trim()).includes(value);
    case 'not_in':
      return !ruleVal.split(',').map(s => s.trim()).includes(value);
    case 'is_null':
      return rawValue === null || rawValue === undefined || value === '';
    case 'is_not_null':
      return rawValue !== null && rawValue !== undefined && value !== '';
    case 'date_after':
      return value >= ruleVal;
    case 'date_before':
      return value <= ruleVal;
    case 'date_between':
      return value >= ruleVal && value <= ruleVal2;
    case 'is_today': {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value.split(' ')[0] === today;
    }
    case 'is_future': {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value !== '' && value.split(' ')[0] > today;
    }
    case 'is_past': {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value !== '' && value.split(' ')[0] < today;
    }
    case 'is_yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value !== '' && value.split(' ')[0] === yesterday;
    }
    case 'is_day_before_yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      const dayBefore = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value !== '' && value.split(' ')[0] === dayBefore;
    }
    case 'is_tomorrow': {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const tomorrow = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value !== '' && value.split(' ')[0] === tomorrow;
    }
    case 'is_today_or_tomorrow': {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dt = new Date(); dt.setDate(dt.getDate() + 1);
      const tomorrow = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      const day = value.split(' ')[0];
      return day === today || day === tomorrow;
    }
    case 'is_future_or_today': {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value !== '' && value.split(' ')[0] >= today;
    }
    case 'is_past_or_today': {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return value !== '' && value.split(' ')[0] <= today;
    }
    default:
      return false;
  }
}

export function evaluateColorRules(
  row: Record<string, unknown>,
  rules: ColorRule[],
): ColorRuleResult {
  // Sort by priority ascending — lower number applied later = wins
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  let rowStyle: StyleObj = {};
  const cellStyles: Record<string, StyleObj> = {};

  for (const rule of sorted) {
    if (!matchesRule(row, rule)) continue;

    const style: StyleObj = { backgroundColor: rule.backgroundColor };
    if (rule.textColor) style.color = rule.textColor;

    if (rule.targetType === 'row') {
      rowStyle = { ...rowStyle, ...style };
    } else if (rule.targetType === 'cell' && rule.targetColumn) {
      cellStyles[rule.targetColumn] = { ...(cellStyles[rule.targetColumn] || {}), ...style };
    }
  }

  return { rowStyle, cellStyles };
}
