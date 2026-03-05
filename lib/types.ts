export interface ColumnDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface FilterCondition {
  column: string;
  operator: string;
  value: string;
  value2?: string;
}

export interface ColorRule {
  id: string;
  name: string;
  targetType: 'row' | 'cell';
  targetColumn?: string; // required when targetType === 'cell'
  conditionColumn: string;
  operator: string;
  value: string;
  value2?: string;
  backgroundColor: string;
  textColor?: string;
  priority: number; // lower = applied later = wins
}

export interface FormulaColumn {
  id: string;
  label: string;
  formula: string; // e.g. "=SE(ÉCÉL.VAZIA(A1);;"Vazio")"
  width?: number; // px, default 150
  insertAfterColumn?: string; // undefined = append at end
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  selectedColumns: string[];
  conditions: FilterCondition[];
  colorRules?: ColorRule[];
  formulaColumns?: FormulaColumn[];
  whatsappLinhasColumns?: string[];
  createdAt: string;
  updatedAt?: string;
}
