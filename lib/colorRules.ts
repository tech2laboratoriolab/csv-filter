import type { ColorRule, ColorCondition } from "./clientDb";

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type StyleObj = Record<string, string>;

export interface ColorRuleResult {
  rowStyle: StyleObj;
  cellStyles: Record<string, StyleObj>;
}

function getConditions(rule: ColorRule): ColorCondition[] {
  if (rule.conditions && rule.conditions.length > 0) return rule.conditions;
  return [
    {
      conditionColumn: rule.conditionColumn ?? "",
      operator: rule.operator ?? "equals",
      value: rule.value ?? "",
      value2: rule.value2,
    },
  ];
}

function matchesCondition(
  row: Record<string, unknown>,
  cond: ColorCondition,
): boolean {
  const rawValue = row[cond.conditionColumn];
  const value = rawValue == null ? "" : String(rawValue);
  const ruleVal = cond.valueIsColumn
    ? row[cond.value] == null
      ? ""
      : String(row[cond.value])
    : cond.value || "";
  const ruleVal2 = cond.value2 || "";

  switch (cond.operator) {
    case "equals":
      return value === ruleVal;
    case "not_equals":
      return value !== ruleVal;
    case "contains":
      return value.toLowerCase().includes(ruleVal.toLowerCase());
    case "not_contains":
      return !value.toLowerCase().includes(ruleVal.toLowerCase());
    case "gt":
      return parseFloat(value) > parseFloat(ruleVal);
    case "gte":
      return parseFloat(value) >= parseFloat(ruleVal);
    case "lt":
      return parseFloat(value) < parseFloat(ruleVal);
    case "lte":
      return parseFloat(value) <= parseFloat(ruleVal);
    case "between": {
      const v = parseFloat(value);
      return v >= parseFloat(ruleVal) && v <= parseFloat(ruleVal2);
    }
    case "in":
      return ruleVal
        .split(",")
        .map((s) => s.trim())
        .includes(value);
    case "not_in":
      return !ruleVal
        .split(",")
        .map((s) => s.trim())
        .includes(value);
    case "is_null":
      return rawValue === null || rawValue === undefined || value === "";
    case "is_not_null":
      return rawValue !== null && rawValue !== undefined && value !== "";
    case "date_after":
      return value >= ruleVal;
    case "date_before":
      return value <= ruleVal;
    case "date_between":
      return value >= ruleVal && value <= ruleVal2;
    case "is_today": {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value.split(" ")[0] === today;
    }
    case "is_future": {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value !== "" && value.split(" ")[0] > today;
    }
    case "is_past": {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value !== "" && value.split(" ")[0] < today;
    }
    case "is_yesterday": {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value !== "" && value.split(" ")[0] === yesterday;
    }
    case "is_day_before_yesterday": {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      const dayBefore = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value !== "" && value.split(" ")[0] === dayBefore;
    }
    case "is_tomorrow": {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value !== "" && value.split(" ")[0] === tomorrow;
    }
    case "is_today_or_tomorrow": {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dt = new Date();
      dt.setDate(dt.getDate() + 1);
      const tomorrow = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      const day = value.split(" ")[0];
      return day === today || day === tomorrow;
    }
    case "is_future_or_today": {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value !== "" && value.split(" ")[0] >= today;
    }
    case "is_past_or_today": {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return value !== "" && value.split(" ")[0] <= today;
    }
    case "days_ahead_gte": {
      const n = parseInt(ruleVal) || 0;
      return value !== "" && value.split(" ")[0] >= offsetDate(n);
    }
    case "days_ahead_lte": {
      const n = parseInt(ruleVal) || 0;
      const day = value.split(" ")[0];
      return value !== "" && day > offsetDate(0) && day <= offsetDate(n);
    }
    case "days_ago_gte": {
      const n = parseInt(ruleVal) || 0;
      return value !== "" && value.split(" ")[0] <= offsetDate(-n);
    }
    case "days_ago_lte": {
      const n = parseInt(ruleVal) || 0;
      const day = value.split(" ")[0];
      return value !== "" && day >= offsetDate(-n) && day < offsetDate(0);
    }
    default:
      return false;
  }
}

function matchesRule(row: Record<string, unknown>, rule: ColorRule): boolean {
  return getConditions(rule).every((cond) => matchesCondition(row, cond));
}

export function colorRuleExtraColumns(
  colorRules: ColorRule[],
  selectedColumns: string[],
  validDbColumns?: string[],
): string[] {
  const cols = new Set<string>();
  for (const rule of colorRules) {
    const conds =
      rule.conditions && rule.conditions.length > 0
        ? rule.conditions
        : rule.conditionColumn
          ? [
              {
                conditionColumn: rule.conditionColumn,
                operator: rule.operator ?? "equals",
                value: rule.value ?? "",
                valueIsColumn: false,
              },
            ]
          : [];
    for (const c of conds) {
      if (c.conditionColumn) cols.add(c.conditionColumn);
      if (c.valueIsColumn && c.value) cols.add(c.value);
    }
  }
  const extra = Array.from(cols).filter((c) => !selectedColumns.includes(c));
  // Filter out non-DB identifiers (e.g. annotation/lookup column IDs) to prevent SQL errors
  return validDbColumns
    ? extra.filter((c) => validDbColumns.includes(c))
    : extra;
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

    if (rule.targetType === "row") {
      rowStyle = { ...rowStyle, ...style };
    } else if (rule.targetType === "cell" && rule.targetColumn) {
      cellStyles[rule.targetColumn] = {
        ...(cellStyles[rule.targetColumn] || {}),
        ...style,
      };
    }
  }

  return { rowStyle, cellStyles };
}
