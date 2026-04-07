'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavedFilter, ColumnDef, FilterCondition, ColorRule, FormulaColumn, AnnotationColumn, LookupColumn } from '@/lib/clientDb';
import ColumnPicker from '@/app/components/ColumnPicker';
import ConditionEditor from '@/app/components/ConditionEditor';
import DataTable from '@/app/components/DataTable';
import ColorRuleEditor from '@/app/components/ColorRuleEditor';
import FormulaColumnEditor from '@/app/components/FormulaColumnEditor';
import AnnotationColumnEditor from '@/app/components/AnnotationColumnEditor';
import TemplateColumnEditor from '@/app/components/TemplateColumnEditor';
import {
  getTableStats,
  queryFiltered,
  evaluateLookupColumns,
  getAnnotations,
  setAnnotation,
  getFilterById,
  saveFilterToFile,
  exportFilteredCSV,
  COLUMNS
} from '@/lib/clientDb';

type Tab = 'columns' | 'filters' | 'color' | 'formula' | 'annotation' | 'template';
const PAGE_SIZE = 50;

interface Props {
  filterId: string;
}

export default function FilterPageClient({ filterId }: Props) {
  const [filter, setFilter] = useState<SavedFilter | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>(COLUMNS);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('columns');
  const [sortCol, setSortCol] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [formulaValues, setFormulaValues] = useState<string[][]>([]);
  const [lookupValues, setLookupValues] = useState<string[][]>([]);
  const [annotationValues, setAnnotationValues] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);

  // Initial load
  useEffect(() => {
    getFilterById(filterId).then(f => {
      if (f) {
        setFilter({
          ...f,
          colorRules: f.colorRules ?? [],
          formulaColumns: f.formulaColumns ?? [],
          annotationColumns: f.annotationColumns ?? [],
        });
      }
    });
  }, [filterId]);

  const fetchData = useCallback(
    async (
      selectedCols?: string[],
      conditions?: FilterCondition[],
      pg?: number,
      sCol?: string,
      sDir?: 'asc' | 'desc',
    ) => {
      if (!filter) return;
      setLoading(true);
      try {
        const result = await queryFiltered(
          selectedCols ?? filter.selectedColumns,
          conditions ?? filter.conditions,
          pg ?? page,
          PAGE_SIZE,
          sCol ?? sortCol,
          sDir ?? sortDir
        );
        setRows(result.rows ?? []);
        setTotal(Number(result.total) ?? 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [filter, page, sortCol, sortDir],
  );

  // Initial data fetch
  useEffect(() => {
    if (filter) fetchData();
  }, [filter, fetchData]); // Only initial when filter is ready

  // Load annotation values whenever rows or annotation columns change
  useEffect(() => {
    if (!filter) return;
    const acs = filter.annotationColumns ?? [];
    if (!acs.length || !rows.length) { setAnnotationValues({}); return; }
    const rowIds = rows.map(r => r._row_id as number);
    const colIds = acs.map(a => a.id);
    getAnnotations(rowIds, colIds).then(annotations => {
      setAnnotationValues(annotations ?? {});
    }).catch(() => {});
  }, [rows, filter?.annotationColumns]);

  // Evaluate lookup columns whenever rows change
  useEffect(() => {
    if (!filter) return;
    const lcs = filter.lookupColumns ?? [];
    if (!lcs.length || !rows.length) { setLookupValues([]); return; }
    evaluateLookupColumns(rows, lcs).then(setLookupValues).catch(() => setLookupValues([]));
  }, [rows, filter?.lookupColumns]);

  // Recompute formula values whenever rows or formula columns change
  useEffect(() => {
    if (!filter) return;
    const fcs = filter.formulaColumns ?? [];
    if (!fcs.length || !rows.length || !columns.length) {
      setFormulaValues([]);
      return;
    }
    const colNames = columns.map(c => c.name);
    import('@/lib/formulaEngine')
      .then(m => m.evaluateFormulasAsync(rows, fcs, colNames))
      .then(vals => setFormulaValues(vals))
      .catch(() => setFormulaValues([]));
  }, [rows, filter?.formulaColumns, columns]);

  if (!filter) {
    return <div style={{ padding: 20 }}>Carregando filtro...</div>;
  }

  const updateFilter = (patch: Partial<SavedFilter>) =>
    setFilter(f => f ? ({ ...f, ...patch }) : f);

  const applyFilters = (
    cols?: string[],
    conds?: FilterCondition[],
    pg = 1,
    sCol?: string,
    sDir?: 'asc' | 'desc',
  ) => {
    setPage(pg);
    fetchData(cols ?? filter.selectedColumns, conds ?? filter.conditions, pg, sCol, sDir);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveFilterToFile({ ...filter, updatedAt: new Date().toISOString() });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    const csvContent = await exportFilteredCSV(filter.selectedColumns, filter.conditions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filter.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (col: string) => {
    const dir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc';
    setSortCol(col);
    setSortDir(dir);
    applyFilters(filter.selectedColumns, filter.conditions, page, col, dir);
  };

  const goPage = (p: number) => {
    setPage(p);
    fetchData(filter.selectedColumns, filter.conditions, p, sortCol, sortDir);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const pageNums = () => {
    const nums: number[] = [];
    let s = Math.max(1, page - 2);
    const e = Math.min(totalPages, s + 4);
    if (e - s < 4) s = Math.max(1, e - 4);
    for (let i = s; i <= e; i++) nums.push(i);
    return nums;
  };

  const colorRules: ColorRule[] = filter.colorRules ?? [];
  const formulaColumns: FormulaColumn[] = filter.formulaColumns ?? [];
  const annotationColumns: AnnotationColumn[] = filter.annotationColumns ?? [];
  const lookupColumns: LookupColumn[] = filter.lookupColumns ?? [];
  const templateColumns = filter.templateColumns ?? [];
  const sampleRow = rows[0];

  const handleAnnotationChange = (rowId: number, colId: string, value: string) => {
    setAnnotationValues(prev => ({ ...prev, [`${rowId}:${colId}`]: value }));
    setAnnotation(rowId, colId, value).catch(() => {});
  };

  const TABS: [Tab, string][] = [
    ['columns', 'Colunas'],
    ['filters', 'Filtros'],
    ['color', 'Regras de Cor'],
    ['formula', 'Colunas de Fórmula'],
    ['annotation', 'Anotações'],
    ['template', 'Mensagens'],
  ];

  return (
    <div className="fp-layout">
      {/* ── Sticky header ── */}
      <div className="fp-header">
        <a href="/" className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
          ← Voltar
        </a>

        {editingName ? (
          <input
            className="fp-title-input"
            value={filter.name}
            onChange={e => updateFilter({ name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
            autoFocus
          />
        ) : (
          <h1
            className="fp-title"
            onClick={() => setEditingName(true)}
            title="Clique para editar o nome"
          >
            {filter.name}
          </h1>
        )}

        <div className="btn-group" style={{ flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExportCSV}>
            📥 Exportar CSV
          </button>
          <button
            className={`btn btn-sm ${saveOk ? 'btn-green' : 'btn-primary'}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : saveOk ? '✓ Salvo' : '💾 Salvar'}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="fp-tabs">
        {TABS.map(([tab, label]) => (
          <button
            key={tab}
            className={`fp-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
            {tab === 'color' && colorRules.length > 0 && (
              <span className="fp-tab-badge">{colorRules.length}</span>
            )}
            {tab === 'formula' && formulaColumns.length > 0 && (
              <span className="fp-tab-badge">{formulaColumns.length}</span>
            )}
            {tab === 'annotation' && annotationColumns.length > 0 && (
              <span className="fp-tab-badge">{annotationColumns.length}</span>
            )}
            {tab === 'template' && templateColumns.length > 0 && (
              <span className="fp-tab-badge">{templateColumns.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab panel ── */}
      <div className="fp-panel">
        {activeTab === 'columns' && (
          <ColumnPicker
            columns={columns}
            selected={filter.selectedColumns}
            onChange={sel => updateFilter({ selectedColumns: sel })}
          />
        )}

        {activeTab === 'filters' && (
          <ConditionEditor
            columns={columns}
            conditions={filter.conditions}
            onChange={conds => updateFilter({ conditions: conds })}
            onApply={() => applyFilters()}
            loading={loading}
          />
        )}

        {activeTab === 'color' && (
          <ColorRuleEditor
            rules={colorRules}
            columns={columns}
            annotationColumns={annotationColumns}
            lookupColumns={lookupColumns}
            onChange={rules => updateFilter({ colorRules: rules })}
          />
        )}

        {activeTab === 'formula' && (
          <FormulaColumnEditor
            formulaColumns={formulaColumns}
            columns={columns}
            selectedCols={filter.selectedColumns}
            sampleRow={sampleRow}
            onChange={fcs => updateFilter({ formulaColumns: fcs })}
          />
        )}

        {activeTab === 'annotation' && (
          <AnnotationColumnEditor
            annotationColumns={annotationColumns}
            columns={columns}
            selectedCols={filter.selectedColumns}
            onChange={acs => updateFilter({ annotationColumns: acs })}
          />
        )}

        {activeTab === 'template' && (
          <TemplateColumnEditor
            templateColumns={templateColumns}
            columns={columns}
            selectedCols={filter.selectedColumns}
            onChange={tcs => updateFilter({ templateColumns: tcs })}
          />
        )}
      </div>

      {/* ── Info bar ── */}
      <div
        style={{
          padding: '6px 16px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: 'var(--text-3)',
          flexShrink: 0,
        }}
      >
        <span>
          {total.toLocaleString('pt-BR')} registro(s) &bull;{' '}
          {filter.selectedColumns.length} coluna(s)
          {colorRules.length > 0 && ` · ${colorRules.length} regra(s) de cor`}
          {formulaColumns.length > 0 && ` · ${formulaColumns.length} fórmula(s)`}
          {annotationColumns.length > 0 && ` · ${annotationColumns.length} anotação(ões)`}
        </span>
        <button
          className="btn btn-sm btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => applyFilters()}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : '🔍'} Aplicar filtros
        </button>
      </div>

      {/* ── Data table ── */}
      <div className="fp-table-area">
        {loading ? (
          <div className="loading-center">
            <span className="spinner" /> Carregando...
          </div>
        ) : (
          <DataTable
            rows={rows}
            selectedCols={filter.selectedColumns}
            columns={columns}
            colorRules={colorRules}
            formulaColumns={formulaColumns}
            formulaValues={formulaValues}
            annotationColumns={annotationColumns}
            annotationValues={annotationValues}
            lookupColumns={lookupColumns}
            lookupValues={lookupValues}
            templateColumns={templateColumns}
            onAnnotationChange={handleAnnotationChange}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="pagination">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de{' '}
            {total.toLocaleString('pt-BR')}
          </span>
          <div className="page-btns">
            <button className="pg-btn" disabled={page <= 1} onClick={() => goPage(1)}>
              «
            </button>
            <button className="pg-btn" disabled={page <= 1} onClick={() => goPage(page - 1)}>
              ‹
            </button>
            {pageNums().map(p => (
              <button
                key={p}
                className={`pg-btn ${p === page ? 'active' : ''}`}
                onClick={() => goPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="pg-btn"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
            >
              ›
            </button>
            <button
              className="pg-btn"
              disabled={page >= totalPages}
              onClick={() => goPage(totalPages)}
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}