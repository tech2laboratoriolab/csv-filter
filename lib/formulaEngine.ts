import type { FormulaColumn } from './clientDb';

// Shifts all A1-style row references by rowIdx.
// e.g. adjustFormula("=A1+B1", 2) → "=A3+B3"
function adjustFormula(formula: string, rowIdx: number): string {
  if (!formula.startsWith('=')) return formula;
  return formula.replace(/([A-Z]+)(\d+)/g, (_, col: string, row: string) => {
    return `${col}${parseInt(row) + rowIdx}`;
  });
}

let langRegistered = false;

async function ensureHyperFormula() {
  const mod = await import('hyperformula');
  const HF = (mod as any).HyperFormula ?? (mod as any).default;

  if (!langRegistered) {
    try {
      const langs = await import('hyperformula/es/i18n/languages/ptPT' as string);
      const ptPT = (langs as any).default ?? langs;
      HF.registerLanguage('ptPT', ptPT);
      langRegistered = true;
    } catch {
      // ptPT not available, fall back to default (en)
    }
  }

  return HF;
}

function cellValueToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    // DetailedCellError
    const err = val as Record<string, unknown>;
    return `#ERR: ${err.type ?? err.value ?? 'ERR'}`;
  }
  return String(val);
}

function buildSheetRow(
  row: Record<string, unknown>,
  columnNames: string[],
  formulaColumns: FormulaColumn[],
  rowIdx: number,
): (string | number | boolean | null)[] {
  const dataRow: (string | number | boolean | null)[] = columnNames.map(name => {
    const v = row[name];
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v;
    const num = parseFloat(String(v).replace(',', '.'));
    if (!isNaN(num) && String(v).trim() !== '') return num;
    return String(v);
  });

  const formulaRow = formulaColumns.map(fc => adjustFormula(fc.formula, rowIdx));
  return [...dataRow, ...formulaRow];
}

export async function evaluateFormulasAsync(
  rows: Record<string, unknown>[],
  formulaColumns: FormulaColumn[],
  columnNames: string[],
): Promise<string[][]> {
  if (!formulaColumns.length || !rows.length) {
    return rows.map(() => formulaColumns.map(() => ''));
  }

  const HF = await ensureHyperFormula();
  const N = columnNames.length;

  const sheetData = rows.map((row, rowIdx) =>
    buildSheetRow(row, columnNames, formulaColumns, rowIdx),
  );

  const config: Record<string, unknown> = { licenseKey: 'gpl-v3' };
  if (langRegistered) config.language = 'ptPT';

  const hf = HF.buildFromArray(sheetData, config);

  const results: string[][] = rows.map((_, rowIdx) =>
    formulaColumns.map((_, fcIdx) => {
      const val = hf.getCellValue({ sheet: 0, row: rowIdx, col: N + fcIdx });
      return cellValueToString(val);
    }),
  );

  hf.destroy();
  return results;
}

export async function evaluateSingleFormula(
  formula: string,
  sampleRow: Record<string, unknown>,
  columnNames: string[],
): Promise<string> {
  if (!formula.startsWith('=')) return '';

  const HF = await ensureHyperFormula();
  const N = columnNames.length;

  const sheetData = [buildSheetRow(sampleRow, columnNames, [{ id: '_', label: '_', formula }], 0)];
  const config: Record<string, unknown> = { licenseKey: 'gpl-v3' };
  if (langRegistered) config.language = 'ptPT';

  const hf = HF.buildFromArray(sheetData, config);
  const val = hf.getCellValue({ sheet: 0, row: 0, col: N });
  hf.destroy();

  return cellValueToString(val);
}
