'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import { queryFiltered, getPrompts, getSavedFilters } from '@/lib/clientDb';
import type { Prompt, SavedFilter } from '@/lib/clientDb';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LaudoRow {
  [key: string]: string;
}

interface AnaliseResult {
  contradicao: 'SIM' | 'NÃO';
  evidencias?: string[];
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string, maxLen = 80): string {
  if (!text) return '—';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

function isLongText(value: string): boolean {
  return value.length > 40;
}

function formatCellValue(key: string, value: string): string {
  if (!value) return '—';
  if (key.startsWith('dta_') && value.includes(' ')) {
    return value.split(' ')[0];
  }
  return value;
}

function getColumnWidth(key: string): string | number {
  if (key === 'cod_requisicao') return 160;
  if (key === 'nom_paciente') return 150;
  if (key === 'laudo_micro') return '35%';
  if (key === 'resultado_ia') return '25%';
  return 'auto';
}

function getColumnLabel(key: string): string {
  const labels: Record<string, string> = {
    cod_requisicao: 'CodRequisicao',
    nom_paciente: 'Paciente',
    laudo_micro: 'LaudoMicro',
    dta_solicitacao: 'DtaSolicitacao',
    dta_finalizacao: 'DtaFinalizacao',
    des_evento: 'DesEvento',
    nom_exame: 'NomExame',
    des_topografia: 'DesTopografia',
  };
  return labels[key] || key;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;
const CONCURRENCY = 8;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnaliseIAClient() {
  const [rows, setRows] = useState<LaudoRow[]>([]);
  const [results, setResults] = useState<Record<string, AnaliseResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jsonPanelOpen, setJsonPanelOpen] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [availableFilters, setAvailableFilters] = useState<SavedFilter[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState<string>('');
  const [filter, setFilter] = useState<SavedFilter | null>(null);
  const [resultFilter, setResultFilter] = useState<'all' | 'SIM' | 'NÃO' | 'error'>('all');
  const [selectedAnalysisColumn, setSelectedAnalysisColumn] = useState<string>('');
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0 });
  const [copied, setCopied] = useState(false);

  // Load prompts and filters on mount
  useEffect(() => {
    Promise.all([
      getPrompts(),
      getSavedFilters(),
    ])
      .then(([promptsData, filtersData]) => {
        setPrompts(promptsData);
        // Default to "Revisor de Contradições" prompt
        const revisorPrompt = promptsData.find(
          (p) => p.name === 'Revisor de Contradições' || p.id === 'prompt-revisor'
        );
        if (revisorPrompt) {
          setSelectedPromptId(revisorPrompt.id);
        } else if (promptsData.length > 0) {
          setSelectedPromptId(promptsData[0].id);
        }

        setAvailableFilters(filtersData);

        if (filtersData.length === 0) {
          setLoadError('Nenhum filtro encontrado. Crie um filtro na página principal.');
          return;
        }

        // Try to find "analise IA" filter first, otherwise use the first filter
        const analiseFilter = filtersData.find(
          (f) => f.name.toLowerCase() === 'analise ia' || f.id === 'analise_ia'
        );
        const defaultFilter = analiseFilter ?? filtersData[0];
        setSelectedFilterId(defaultFilter.id);
        setFilter(defaultFilter);
        // Prefer the prompt's defaultColumn (e.g. laudo_micro) over selectedColumns[0]
        const defaultCol = revisorPrompt?.defaultColumn ?? defaultFilter.selectedColumns[0] ?? '';
        setSelectedAnalysisColumn(defaultCol);

      })
      .catch(() => setLoadError('Erro ao carregar dados iniciais.'))
      .finally(() => setPromptsLoading(false));
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((filterId: string) => {
    setSelectedFilterId(filterId);
    const newFilter = availableFilters.find((f) => f.id === filterId);
    if (!newFilter) return;

    setFilter(newFilter);
    // Keep the prompt's defaultColumn when switching filters
    setSelectedAnalysisColumn((prev) => {
      const promptDefault = prompts.find((p) => p.id === selectedPromptId)?.defaultColumn;
      return promptDefault ?? newFilter.selectedColumns[0] ?? prev;
    });
    setResults({});
    setJsonPanelOpen(false);

  }, [availableFilters, prompts, selectedPromptId]);

  // Load laudos when filter changes
  useEffect(() => {
    if (!filter || !selectedAnalysisColumn) return;

    (async () => {
      try {
        setRows([]);
        const allCols = Array.from(new Set([...filter.selectedColumns, 'cod_requisicao', selectedAnalysisColumn]));
        const { rows: rawRows } = await queryFiltered(
          allCols,
          filter.conditions,
          1,
          1000,
        );
        const mapped: LaudoRow[] = (rawRows as any[])
          .filter((r) => r[selectedAnalysisColumn])
          .map((r) => {
            const obj: LaudoRow = {};
            allCols.forEach((col) => {
              obj[col] = String(r[col] ?? '');
            });
            return obj;
          });
        setRows(mapped);
      } catch (e: any) {
        setLoadError(e?.message ?? 'Erro ao carregar laudos.');
      }
    })();
  }, [filter, selectedAnalysisColumn]);

  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing || rows.length === 0 || !selectedPrompt || !selectedAnalysisColumn) return;
    setIsAnalyzing(true);
    setProgress({ done: 0, total: rows.length });
    setResults({});
    setResultFilter('all');
    setTokenUsage({ input: 0, output: 0 });

    const newResults: Record<string, AnaliseResult> = {};

    const chunks: LaudoRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks.push(rows.slice(i, i + BATCH_SIZE));
    }

    const processChunk = async (chunk: LaudoRow[]) => {
      const fetchSingle = async (row: LaudoRow) => {
        try {
          const res = await fetch('/api/analise-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ laudoMicro: row[selectedAnalysisColumn], prompt: selectedPrompt.text }),
          });
          const d = await res.json();
          newResults[row.cod_requisicao] = res.ok
            ? (d as AnaliseResult)
            : { contradicao: 'NÃO' as const, error: d.error ?? 'Erro desconhecido' };
          if (res.ok) {
            setTokenUsage((prev) => ({ input: prev.input + (d.inputTokens ?? 0), output: prev.output + (d.outputTokens ?? 0) }));
          }
        } catch (e: any) {
          newResults[row.cod_requisicao] = { contradicao: 'NÃO' as const, error: e?.message ?? 'Falha de rede' };
        }
        setResults({ ...newResults });
        setProgress({ done: Object.keys(newResults).length, total: rows.length });
      };

      const tryBatch = async (): Promise<boolean> => {
        try {
          const res = await fetch('/api/analise-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: chunk.map((r) => ({ codRequisicao: r.cod_requisicao, laudoMicro: r[selectedAnalysisColumn] })),
              prompt: selectedPrompt.text,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.results) return false;
          for (const [codReq, result] of Object.entries(data.results)) {
            newResults[codReq] = result as AnaliseResult;
          }
          setTokenUsage((prev) => ({ input: prev.input + (data.totalInputTokens ?? 0), output: prev.output + (data.totalOutputTokens ?? 0) }));
          if (Array.isArray(data.missing) && data.missing.length > 0) {
            const missingRows = chunk.filter((r) => (data.missing as string[]).includes(r.cod_requisicao));
            await Promise.all(missingRows.map(fetchSingle));
          }
          return true;
        } catch (e: any) {
          console.error('[analise-ia-client] Batch falhou:', e);
          return false;
        }
      };

      // ── Tentativa 1: Batch ──────────────────────────────────────────────
      let batchSuccess = await tryBatch();

      // ── Tentativa 2: Retry Batch (com delay) ────────────────────────────
      if (!batchSuccess) {
        await new Promise((r) => setTimeout(r, 1500));
        batchSuccess = await tryBatch();
      }

      // ── Fallback: Individual (em paralelo) ──────────────────────────────
      if (!batchSuccess) {
        await Promise.all(chunk.map(fetchSingle));
      } else {
        setResults({ ...newResults });
        setProgress({ done: Object.keys(newResults).length, total: rows.length });
      }
    };

    // Processa chunks em paralelo com semáforo de concorrência
    await new Promise<void>((resolve) => {
      if (chunks.length === 0) { resolve(); return; }

      let chunkIndex = 0;
      let activeCount = 0;

      const pump = () => {
        while (activeCount < CONCURRENCY && chunkIndex < chunks.length) {
          const chunk = chunks[chunkIndex++];
          activeCount++;
          processChunk(chunk).finally(() => {
            activeCount--;
            if (activeCount === 0 && chunkIndex >= chunks.length) {
              resolve();
            } else {
              pump();
            }
          });
        }
      };

      pump();
    });

    setIsAnalyzing(false);
  }, [isAnalyzing, rows, selectedPrompt, selectedAnalysisColumn]);

  // Dynamic columns for table (filter columns + resultado_ia)
  const tableColumns = filter
    ? [...filter.selectedColumns.filter((c) => c !== 'resultado_ia'), 'resultado_ia']
    : [];

  const countErrors = rows.filter((r) => !!results[r.cod_requisicao]?.error).length;
  const countSim = rows.filter((r) => results[r.cod_requisicao]?.contradicao === 'SIM' && !results[r.cod_requisicao]?.error).length;
  const countNao = rows.filter((r) => results[r.cod_requisicao]?.contradicao === 'NÃO' && !results[r.cod_requisicao]?.error).length;
  const countAll = Object.keys(results).length;

  const displayedRows = resultFilter === 'all'
    ? rows
    : resultFilter === 'error'
    ? rows.filter((r) => !!results[r.cod_requisicao]?.error)
    : rows.filter((r) => results[r.cod_requisicao]?.contradicao === resultFilter && !results[r.cod_requisicao]?.error);

  // Build JSON output array (respects active filter)
  const jsonOutput = displayedRows
    .filter((r) => results[r.cod_requisicao])
    .map((r) => ({
      cod_requisicao: r.cod_requisicao,
      nom_paciente: r.nom_paciente,
      ...results[r.cod_requisicao],
    }));

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-0)',
    fontSize: 13,
    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
    marginTop: 4,
    marginBottom: 8,
  };

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };

  return (
    <div className="app">
      <style>{`
        .ia-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
        .ia-table th {
          background: #f1f5f9;
          font-weight: 600;
          color: var(--text-2);
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 1;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ia-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
          color: var(--text-1);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ia-table td.wrap {
          white-space: normal;
          word-break: break-word;
        }
        .ia-table tr:hover td { background: #f8fafc; }
        .badge-tipo {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .badge-sim  { background: #fee2e2; color: #b91c1c; }
        .badge-nao  { background: #dcfce7; color: #166534; }
        .badge-err  { background: #fef9c3; color: #78350f; }
        .evidencias-list { margin: 4px 0 0 0; padding-left: 16px; color: #b91c1c; font-size: 12px; }
        .result-tab {
          width: 100%;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1.5px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
          background: var(--bg-1);
          color: var(--text-2);
          border-color: var(--border);
          text-align: left;
          margin-bottom: 4px;
        }
        .result-tab:hover { border-color: #94a3b8; }
        .result-tab.active-all  { background: #ede9fe; color: #6d28d9; border-color: #8b5cf6; }
        .result-tab.active-sim  { background: #fee2e2; color: #b91c1c; border-color: #f87171; }
        .result-tab.active-nao  { background: #dcfce7; color: #166534; border-color: #4ade80; }
        .result-tab.active-err  { background: #fef9c3; color: #78350f; border-color: #fde047; }
      `}</style>

      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 6 }}>
            <Link href="/anotacoes" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 12, textAlign: 'center' }}>
              ← Voltar
            </Link>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-0)', textAlign: 'center' }}>
              🤖 Análise de IA
            </span>
          </div>
          <div className="stats-row" style={{ marginTop: 10 }}>
            <div className="stat">
              <div className="stat-value">{rows.length}</div>
              <div className="stat-label">Laudos</div>
            </div>
            {tokenUsage.input > 0 && (
              <div className="stat">
                <div className="stat-value">{((tokenUsage.input + tokenUsage.output) / 1000).toFixed(1)}k</div>
                <div className="stat-label">~${((tokenUsage.input * 0.15 + tokenUsage.output * 0.60) / 1_000_000).toFixed(4)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-scroll">

          {/* Configuração */}
          <div className="section">
            <div className="section-title">Configuração</div>
            <div style={{ padding: '0 4px' }}>
              <label style={labelStyle}>Filtro</label>
              <select
                value={selectedFilterId}
                onChange={(e) => handleFilterChange(e.target.value)}
                disabled={isAnalyzing || availableFilters.length === 0}
                style={selectStyle}
              >
                {availableFilters.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              <label style={labelStyle}>Coluna de análise</label>
              <select
                value={selectedAnalysisColumn}
                onChange={(e) => {
                  setSelectedAnalysisColumn(e.target.value);
                  setResults({});
                  setJsonPanelOpen(false);
                }}
                disabled={isAnalyzing || !filter || filter.selectedColumns.length === 0}
                style={selectStyle}
              >
                {filter && Array.from(new Set([
                  ...filter.selectedColumns,
                  ...(selectedPrompt?.defaultColumn ? [selectedPrompt.defaultColumn] : []),
                ])).map((col) => (
                  <option key={col} value={col}>{getColumnLabel(col)}</option>
                ))}
              </select>

              <label style={labelStyle}>Prompt</label>
              <select
                value={selectedPromptId}
                onChange={(e) => {
                  const newPrompt = prompts.find((p) => p.id === e.target.value);
                  setSelectedPromptId(e.target.value);
                  if (newPrompt?.defaultColumn) {
                    setSelectedAnalysisColumn(newPrompt.defaultColumn);
                  }
                }}
                disabled={isAnalyzing || promptsLoading}
                style={{ ...selectStyle, marginBottom: 6 }}
              >
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Link
                href="/anotacoes/analise-ia/config"
                style={{
                  display: 'block',
                  padding: '5px 10px',
                  fontSize: 12,
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-2)',
                  textDecoration: 'none',
                  textAlign: 'center',
                  marginBottom: 4,
                }}
              >
                ⚙️ Config
              </Link>
            </div>
          </div>

          {/* Análise */}
          <div className="section">
            <div className="section-title">Análise</div>
            <div style={{ padding: '0 4px' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleAnalyze}
                disabled={isAnalyzing || rows.length === 0 || !selectedPrompt || !selectedAnalysisColumn}
              >
                {isAnalyzing ? <><span className="spinner" /> Analisando…</> : '▶ Analisar Tudo'}
              </button>
              {progress && (
                <div style={{ marginTop: 10 }}>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    <span>{progress.done}/{progress.total} laudos</span>
                    <span>{Math.round((progress.done / progress.total) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resultados */}
          {countAll > 0 && (
            <div className="section">
              <div className="section-title">Resultados ({countAll})</div>
              <div style={{ padding: '0 4px' }}>
                <button
                  className={`result-tab${resultFilter === 'all' ? ' active-all' : ''}`}
                  onClick={() => setResultFilter('all')}
                >
                  Todos ({countAll})
                </button>
                <button
                  className={`result-tab${resultFilter === 'SIM' ? ' active-sim' : ''}`}
                  onClick={() => setResultFilter('SIM')}
                >
                  ⚠ Contradição ({countSim})
                </button>
                <button
                  className={`result-tab${resultFilter === 'NÃO' ? ' active-nao' : ''}`}
                  onClick={() => setResultFilter('NÃO')}
                >
                  ✓ OK ({countNao})
                </button>
                {countErrors > 0 && (
                  <button
                    className={`result-tab${resultFilter === 'error' ? ' active-err' : ''}`}
                    onClick={() => setResultFilter('error')}
                  >
                    ⚠ Erro ({countErrors})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* JSON Output */}
          {jsonOutput.length > 0 && (
            <div className="section">
              <div className="section-title">Visualização</div>
              <div style={{ padding: '0 4px', display: 'flex', gap: 6 }}>
                <button
                  className={`result-tab${!jsonPanelOpen ? ' active-all' : ''}`}
                  onClick={() => setJsonPanelOpen(false)}
                >
                  Tabela
                </button>
                <button
                  className={`result-tab${jsonPanelOpen ? ' active-all' : ''}`}
                  onClick={() => setJsonPanelOpen(true)}
                >
                  JSON ({jsonOutput.length})
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ===== MAIN ===== */}
      <div className="main">
        <div className="main-content" style={{ padding: 0 }}>
          {loadError && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', margin: 16, borderRadius: 8, fontSize: 13 }}>
              {loadError}
            </div>
          )}

          {!loadError && !filter && (
            <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', marginTop: 48 }}>
              Carregando filtro...
            </div>
          )}

          {filter && jsonPanelOpen && jsonOutput.length > 0 && (
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0, background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
                <span style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>
                  JSON — {jsonOutput.length} resultado{jsonOutput.length !== 1 ? 's' : ''}
                </span>
                <button
                  style={{
                    marginLeft: 'auto',
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: `1px solid ${copied ? '#4ade80' : '#334155'}`,
                    background: copied ? '#166534' : '#1e293b',
                    color: copied ? '#fff' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(jsonOutput, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? '✓ Copiado!' : 'Copiar JSON'}
                </button>
              </div>
              <pre style={{ flex: 1, overflow: 'auto', margin: 0, padding: 16, color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre', lineHeight: 1.6 }}>
                {JSON.stringify(jsonOutput, null, 2)}
              </pre>
            </div>
          )}

          {filter && !jsonPanelOpen && (
            <div style={{ flex: 1, overflow: 'auto', background: '#fff', minHeight: 0 }}>
              <table className="ia-table">
                <thead>
                  <tr>
                    {tableColumns.map((col) => (
                      <th
                        key={col}
                        style={{
                          width: getColumnWidth(col),
                          minWidth: col === 'laudo_micro' ? 200 : undefined,
                        }}
                      >
                        {getColumnLabel(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tableColumns.length || 1}
                        style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)', fontSize: 13 }}
                      >
                        {rows.length === 0
                          ? 'Nenhum laudo encontrado — verifique se o CSV foi carregado.'
                          : 'Nenhum resultado para este filtro.'}
                      </td>
                    </tr>
                  ) : displayedRows.map((row, index) => {
                    const result = results[row.cod_requisicao];
                    return (
                      <tr key={row.cod_requisicao || String(index)}>
                        {tableColumns.map((col) => {
                          if (col === 'resultado_ia') {
                            return (
                              <td key={col} className="wrap" style={{ minWidth: 200, maxWidth: 320 }}>
                                {!result && isAnalyzing && (
                                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>aguardando…</span>
                                )}
                                {result?.error && (
                                  <span className="badge-tipo badge-err" title={result.error}>⚠ erro</span>
                                )}
                                {result && !result.error && (
                                  <div>
                                    <span className={`badge-tipo ${result.contradicao === 'SIM' ? 'badge-sim' : 'badge-nao'}`}>
                                      {result.contradicao === 'SIM' ? '⚠ Contradição' : '✓ OK'}
                                    </span>
                                    {result.evidencias && result.evidencias.length > 0 && (
                                      <ul className="evidencias-list">
                                        {result.evidencias.map((ev, i) => (
                                          <li key={i}>{ev}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          }

                          const value = row[col] ?? '';
                          const isLong = isLongText(value);

                          return (
                            <td
                              key={col}
                              className={isLong ? 'wrap' : ''}
                              style={{
                                fontFamily: col === 'cod_requisicao' ? 'monospace' : undefined,
                                fontSize: 12,
                                width: getColumnWidth(col),
                                maxWidth: col === 'laudo_micro' ? 400 : undefined,
                              }}
                              title={isLong ? value : undefined}
                            >
                              {col === 'laudo_micro'
                                ? truncate(value, 120)
                                : formatCellValue(col, value)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
