'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { queryFiltered, getPrompts } from '@/lib/clientDb';
import type { FilterCondition, Prompt } from '@/lib/clientDb';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LaudoRow {
  cod_requisicao: string;
  nom_paciente: string;
  laudo_micro: string;
  nom_exame: string;
}

interface AnaliseResult {
  contradicao: 'SIM' | 'NÃO';
  evidencias?: string[];
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CITO_EXAMES = 'REDE - CITOPATOLOGIA,COLPOCITOLOGIA ONCÓTICA CONVENCIONAL,COLPOCITOLOGIA ONCÓTICA EM MEIO LÍQUIDO,REVISÃO DE LÂMINA INTERNA,CITOLOGIA ANAL CONVENCIONAL,CITOLOGIA ONCÓTICA DE LÍQUIDOS,CITOLOGIA EM MEIO LÍQUIDO URINÁRIO';

const CONDITIONS: FilterCondition[] = [
  { column: 'des_evento', operator: 'equals', value: 'Laudo Concluído (Definitivo)' },
  { column: 'laudo_micro', operator: 'is_not_null', value: '' },
  { column: 'nom_exame', operator: 'in', value: CITO_EXAMES },
];

const SELECTED_COLS = [
  'cod_requisicao',
  'nom_paciente',
  'laudo_micro',
  'nom_exame',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string, maxLen = 80): string {
  if (!text) return '—';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
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

  // Load prompts on mount
  useEffect(() => {
    getPrompts()
      .then((p) => {
        setPrompts(p);
        if (p.length > 0) setSelectedPromptId(p[0].id);
      })
      .catch(() => {})
      .finally(() => setPromptsLoading(false));
  }, []);

  // Load laudos on mount
  useEffect(() => {
    (async () => {
      try {
        const { rows: rawRows } = await queryFiltered(
          SELECTED_COLS,
          CONDITIONS,
          1,
          1000,
        );
        const mapped: LaudoRow[] = (rawRows as any[])
          .filter((r) => r.laudo_micro)
          .map((r) => ({
            cod_requisicao: String(r.cod_requisicao ?? ''),
            nom_paciente: String(r.nom_paciente ?? ''),
            laudo_micro: String(r.laudo_micro ?? ''),
            nom_exame: String(r.nom_exame ?? ''),
          }));
        setRows(mapped);
      } catch (e: any) {
        setLoadError(e?.message ?? 'Erro ao carregar laudos.');
      }
    })();
  }, []);

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      <style>{`
        .ia-table { width: 100%; border-collapse: collapse; font-size: 13px; }
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
        }
        .ia-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
          color: var(--text-1);
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
          Laudos Concluídos (Definitivo) · CITO
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

        {!loadError && rows.length === 0 && !isAnalyzing && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', marginTop: 48 }}>
            Nenhum laudo encontrado com <strong>Laudo Concluído (Definitivo)</strong> e LaudoMicro preenchido.
            <br />
            <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>Certifique-se de que o CSV foi carregado.</span>
          </div>
        )}

        {rows.length > 0 && (
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
                    <th style={{ width: 100 }}>CodRequisicao</th>
                    <th style={{ width: 150 }}>Paciente</th>
                    <th style={{ width: '40%' }}>LaudoMicro</th>
                    <th style={{ width: '30%', minWidth: 200 }}>Resultado IA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const result = results[row.cod_requisicao];
                    return (
                      <tr key={row.cod_requisicao}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', width: 100 }}>
                          {row.cod_requisicao}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', width: 150, fontSize: 12 }}>{row.nom_paciente || '—'}</td>
                        <td style={{ width: '40%', color: 'var(--text-2)', fontSize: 12 }}>
                          {truncate(row.laudo_micro, 120)}
                        </td>
                        <td style={{ width: '30%', minWidth: 200 }}>
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
