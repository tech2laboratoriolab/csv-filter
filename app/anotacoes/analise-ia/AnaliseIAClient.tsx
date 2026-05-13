'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { queryFiltered, getPrompts, getSavedFilters } from '@/lib/clientDb';
import type { FilterCondition, Prompt, SavedFilter } from '@/lib/clientDb';

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
  if (key === 'cod_requisicao') return 100;
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
  const [filter, setFilter] = useState<SavedFilter | null>(null);
  const [columns, setColumns] = useState<string[]>([]);

  // Load prompts and filter on mount
  useEffect(() => {
    Promise.all([
      getPrompts(),
      getSavedFilters(),
    ])
      .then(([promptsData, filtersData]) => {
        setPrompts(promptsData);
        if (promptsData.length > 0) setSelectedPromptId(promptsData[0].id);

        // Find "analise IA" filter
        const analiseFilter = filtersData.find(
          (f) => f.name.toLowerCase() === 'analise ia' || f.id === 'analise_ia'
        );
        if (analiseFilter) {
          setFilter(analiseFilter);
          // Ensure required columns are present
          const requiredCols = ['cod_requisicao', 'laudo_micro'];
          const allCols = Array.from(new Set([...analiseFilter.selectedColumns, ...requiredCols]));
          setColumns(allCols);
        } else {
          setLoadError('Filtro "analise IA" não encontrado. Crie o filtro na página principal.');
        }
      })
      .catch(() => setLoadError('Erro ao carregar dados iniciais.'))
      .finally(() => setPromptsLoading(false));
  }, []);

  // Load laudos when filter is available
  useEffect(() => {
    if (!filter) return;

    (async () => {
      try {
        const allCols = Array.from(new Set([...filter.selectedColumns, 'cod_requisicao', 'laudo_micro']));
        const { rows: rawRows } = await queryFiltered(
          allCols,
          filter.conditions,
          1,
          1000,
        );
        const mapped: LaudoRow[] = (rawRows as any[])
          .filter((r) => r.laudo_micro)
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
  }, [filter]);

  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing || rows.length === 0 || !selectedPrompt) return;
    setIsAnalyzing(true);
    setProgress({ done: 0, total: rows.length });
    setResults({});

    const newResults: Record<string, AnaliseResult> = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const res = await fetch('/api/analise-ia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            laudoMicro: row.laudo_micro,
            prompt: selectedPrompt.text,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          newResults[row.cod_requisicao] = { contradicao: 'NÃO', error: data.error ?? 'Erro desconhecido' };
        } else {
          newResults[row.cod_requisicao] = data;
        }
      } catch (e: any) {
        newResults[row.cod_requisicao] = { contradicao: 'NÃO', error: e?.message ?? 'Falha de rede' };
      }

      // Update state progressively
      setResults({ ...newResults });
      setProgress({ done: i + 1, total: rows.length });
    }

    setIsAnalyzing(false);
  }, [isAnalyzing, rows, selectedPrompt]);

  // Build JSON output array
  const jsonOutput = rows
    .filter((r) => results[r.cod_requisicao])
    .map((r) => ({
      cod_requisicao: r.cod_requisicao,
      nom_paciente: r.nom_paciente,
      ...results[r.cod_requisicao],
    }));

  // Dynamic columns for table (filter columns + resultado_ia)
  const tableColumns = filter
    ? [...filter.selectedColumns.filter((c) => c !== 'resultado_ia'), 'resultado_ia']
    : [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
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
        .json-panel {
          background: #0f172a;
          color: #e2e8f0;
          font-family: monospace;
          font-size: 12px;
          padding: 16px;
          border-radius: 8px;
          overflow: auto;
          max-height: 400px;
          white-space: pre;
        }
        .analyze-btn {
          padding: 8px 18px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .analyze-btn:not(:disabled):hover { opacity: 0.9; }
        .progress-bar-track {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
          flex: 1;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          border-radius: 2px;
          transition: width 0.2s;
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(to right, #eff6ff, #eef2ff, #f5f3ff)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        flexShrink: 0,
      }}>
        <Link href="/anotacoes" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 13 }}>
          ← Voltar
        </Link>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-0)' }}>
          🤖 Análise de IA
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>
          {filter ? filter.name : 'Carregando...'}
        </span>
        {/* Indicador de linhas */}
        <span style={{
          marginLeft: 'auto',
          fontSize: 12,
          color: 'var(--text-2)',
          background: 'var(--bg-1)',
          padding: '4px 10px',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          {rows.length} laudo{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 24, background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {loadError && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {loadError}
          </div>
        )}

        {!loadError && !filter && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', marginTop: 48 }}>
            Carregando filtro...
          </div>
        )}

        {filter && rows.length === 0 && !isAnalyzing && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', marginTop: 48 }}>
            Nenhum laudo encontrado com as condições do filtro <strong>{filter.name}</strong>.
            <br />
            <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>Certifique-se de que o CSV foi carregado.</span>
          </div>
        )}

        {filter && rows.length > 0 && (
          <>
            {/* Prompt Selector + Analyze Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  Prompt:
                </label>
                <select
                  value={selectedPromptId}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  disabled={isAnalyzing || promptsLoading}
                  style={{
                    flex: 1,
                    minWidth: 200,
                    padding: '6px 10px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-0)',
                    fontSize: 13,
                    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Link
                  href="/anotacoes/analise-ia/config"
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-2)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⚙️ Config
                </Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {progress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {progress.done}/{progress.total}
                    </span>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  className="analyze-btn"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || rows.length === 0 || !selectedPrompt}
                >
                  {isAnalyzing ? 'Analisando…' : '▶ Analisar Tudo'}
                </button>
              </div>
            </div>

            {/* Table with scroll */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: '#fff',
              marginBottom: 24,
              minHeight: 0,
            }}>
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
                  {rows.map((row) => {
                    const result = results[row.cod_requisicao];
                    return (
                      <tr key={row.cod_requisicao}>
                        {tableColumns.map((col) => {
                          if (col === 'resultado_ia') {
                            return (
                              <td key={col} style={{ minWidth: 200 }}>
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

            {/* JSON Output Panel */}
            {jsonOutput.length > 0 && (
              <div style={{ marginBottom: 24, flexShrink: 0 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}
                  onClick={() => setJsonPanelOpen((v) => !v)}
                >
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-0)' }}>
                    {jsonPanelOpen ? '▾' : '▸'} Resultado JSON ({jsonOutput.length} laudos)
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(JSON.stringify(jsonOutput, null, 2));
                    }}
                    style={{
                      padding: '2px 10px',
                      fontSize: 11,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: '#fff',
                      cursor: 'pointer',
                      color: 'var(--text-2)',
                    }}
                  >
                    Copiar
                  </button>
                </div>
                {jsonPanelOpen && (
                  <div className="json-panel">
                    {JSON.stringify(jsonOutput, null, 2)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
