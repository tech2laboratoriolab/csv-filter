'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavedFilter, ColumnDef, FilterCondition, ColorRule, FormulaColumn, AnnotationColumn } from '@/lib/types';
import ColumnPicker from '@/app/components/ColumnPicker';
import ConditionEditor from '@/app/components/ConditionEditor';
import DataTable from '@/app/components/DataTable';
import ColorRuleEditor from '@/app/components/ColorRuleEditor';
import FormulaColumnEditor from '@/app/components/FormulaColumnEditor';
import AnnotationColumnEditor from '@/app/components/AnnotationColumnEditor';

type Tab = 'columns' | 'filters' | 'color' | 'formula' | 'annotation';
const PAGE_SIZE = 50;

interface Props {
  initialFilter: SavedFilter;
}

export default function FilterPageClient({ initialFilter }: Props) {
  const [filter, setFilter] = useState<SavedFilter>({
    ...initialFilter,
    colorRules: initialFilter.colorRules ?? [],
    formulaColumns: initialFilter.formulaColumns ?? [],
    annotationColumns: initialFilter.annotationColumns ?? [],
  });
  const [columns, setColumns] = useState<ColumnDef[]>([]);
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
  const [annotationValues, setAnnotationValues] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);

  // Load column definitions
  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => {
        if (d.columns) setColumns(d.columns);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(
    async (
      selectedCols?: string[],
      conditions?: FilterCondition[],
      pg?: number,
      sCol?: string,
      sDir?: 'asc' | 'desc',
    ) => {
      setLoading(true);
      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedColumns: selectedCols ?? filter.selectedColumns,
            conditions: conditions ?? filter.conditions,
            page: pg ?? page,
            pageSize: PAGE_SIZE,
            sortColumn: sCol ?? sortCol,
            sortDir: sDir ?? sortDir,
          }),
        });
        const d = await res.json();
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter.selectedColumns, filter.conditions, page, sortCol, sortDir],
  );

  // Initial data fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  // Load annotation values whenever rows or annotation columns change
  useEffect(() => {
    const acs = filter.annotationColumns ?? [];
    if (!acs.length || !rows.length) { setAnnotationValues({}); return; }
    const rowIds = rows.map(r => r._row_id as number);
    const colIds = acs.map(a => a.id);
    fetch(`/api/annotations?rowIds=${rowIds.join(',')}&colIds=${colIds.join(',')}`)
      .then(r => r.json())
      .then(d => setAnnotationValues(d.annotations ?? {}))
      .catch(() => {});
  }, [rows, filter.annotationColumns]);

  // Recompute formula values whenever rows or formula columns change
  useEffect(() => {
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
  }, [rows, filter.formulaColumns, columns]);

  const updateFilter = (patch: Partial<SavedFilter>) =>
    setFilter(f => ({ ...f, ...patch }));

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
      await fetch('/api/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filter, updatedAt: new Date().toISOString() }),
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedColumns: filter.selectedColumns,
        conditions: filter.conditions,
      }),
    });
    const blob = await res.blob();
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
  const sampleRow = rows[0];

  const handleAnnotationChange = (rowId: number, colId: string, value: string) => {
    setAnnotationValues(prev => ({ ...prev, [`${rowId}:${colId}`]: value }));
    fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, colId, value }),
    }).catch(() => {});
  };

  const TABS: [Tab, string][] = [
    ['columns', 'Colunas'],
    ['filters', 'Filtros'],
    ['color', 'Regras de Cor'],
    ['formula', 'Colunas de Fórmula'],
    ['annotation', 'Anotações'],
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
