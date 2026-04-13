export const OPS_TEXT = [
  { v: 'equals', l: 'Igual' },
  { v: 'not_equals', l: '≠ Diferente' },
  { v: 'contains', l: 'Contém' },
  { v: 'not_contains', l: 'Não contém' },
  { v: 'in', l: 'Em (lista)' },
  { v: 'not_in', l: 'Não em (lista)' },
  { v: 'is_null', l: 'É vazio / nulo' },
  { v: 'is_not_null', l: 'Não é vazio' },
  { v: 'unique_combination', l: 'Combinação única' },
];

export const OPS_NUM = [
  { v: 'equals', l: '= Igual' },
  { v: 'not_equals', l: '≠ Diferente' },
  { v: 'gt', l: '> Maior' },
  { v: 'gte', l: '≥ Maior ou igual' },
  { v: 'lt', l: '< Menor' },
  { v: 'lte', l: '≤ Menor ou igual' },
  { v: 'between', l: 'Entre' },
  { v: 'is_null', l: 'É vazio / nulo' },
  { v: 'is_not_null', l: 'Não é vazio' },
];

export const OPS_DATE = [
  { v: 'equals', l: 'Igual' },
  { v: 'date_after', l: 'Após' },
  { v: 'date_before', l: 'Antes' },
  { v: 'date_between', l: 'Entre' },
  { v: 'is_today', l: 'É hoje' },
  { v: 'is_yesterday', l: 'É ontem' },
  { v: 'is_day_before_yesterday', l: 'É anteontem' },
  { v: 'is_tomorrow', l: 'É amanhã' },
  { v: 'is_today_or_tomorrow', l: 'É hoje ou amanhã' },
  { v: 'is_future', l: 'É futuro (após hoje)' },
  { v: 'is_future_or_today', l: 'É futuro ou hoje (≥ hoje)' },
  { v: 'is_past', l: 'É passado (antes de hoje)' },
  { v: 'is_past_or_today', l: 'É passado ou hoje (≤ hoje)' },
  { v: 'days_ahead_gte', l: '≥ N dias no futuro' },
  { v: 'days_ahead_lte', l: '≤ N dias no futuro' },
  { v: 'days_ago_gte',   l: '≥ N dias no passado' },
  { v: 'days_ago_lte',   l: '≤ N dias no passado' },
  { v: 'is_null', l: 'É vazio / nulo' },
  { v: 'is_not_null', l: 'Não é vazio' },
];

export function getOpsForType(type: 'text' | 'number' | 'date') {
  if (type === 'number') return OPS_NUM;
  if (type === 'date') return OPS_DATE;
  return OPS_TEXT;
}
