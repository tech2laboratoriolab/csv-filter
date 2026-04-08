'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface Patologista {
  nome: string;
  telefone?: string;
}

interface LaudoRow {
  id: string;
  protocolo?: string;
  nom_paciente?: string;
  tipo_material?: string;
  dta_recebimento?: string;
  prazo?: string;
  prioridade?: 'Normal' | 'Urgente' | 'Urgentíssimo';
  status?: 'Pendente' | 'Em análise' | 'Concluído' | 'Revisão';
  laudo?: string;
  observacoes?: string;
}

interface PatologistaSchedule {
  patologistaId: string;
  rows: LaudoRow[];
}

interface SemanaData {
  weekKey: string;
  patologistas: PatologistaSchedule[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSaturday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function parseDateLocal(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function displayWeek(weekKey: string): string {
  const sat = parseDateLocal(weekKey);
  const sun = addDays(sat, 1);
  return `Sáb ${fmtBR(toIso(sat))}  –  Dom ${fmtBR(toIso(sun))}`;
}

function nomeDisplay(slug: string): string {
  return slug.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Colour mappings ───────────────────────────────────────────────────────────

const PRIO_STYLE: Record<string, React.CSSProperties> = {
  'Normal':        { color: 'var(--text-3)', background: 'var(--bg-3)', borderColor: 'var(--border)' },
  'Urgente':       { color: '#d97706', background: 'var(--orange-bg)', borderColor: 'rgba(245,158,11,0.3)' },
  'Urgentíssimo':  { color: '#dc2626', background: 'var(--red-bg)',    borderColor: 'rgba(239,68,68,0.3)' },
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  'Pendente':    { color: 'var(--text-2)', background: 'var(--bg-3)',    borderColor: 'var(--border)' },
  'Em análise':  { color: 'var(--blue)',   background: 'var(--blue-bg)', borderColor: 'rgba(59,130,246,0.3)' },
  'Concluído':   { color: '#16a34a',       background: 'var(--green-bg)',borderColor: 'rgba(34,197,94,0.3)' },
  'Revisão':     { color: '#d97706',       background: 'var(--orange-bg)',borderColor: 'rgba(245,158,11,0.3)' },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SemanaClient() {
  const [patologistas, setPatologistas]   = useState<Patologista[]>([]);
  const [semanas, setSemanas]             = useState<string[]>([]);
  const [currentWeek, setCurrentWeek]    = useState<string>('');
  const [data, setData]                  = useState<SemanaData | null>(null);
  const [activeTab, setActiveTab]        = useState<string>('');
  const [loading, setLoading]            = useState(false);
  const [saving, setSaving]              = useState(false);
  const [savedOk, setSavedOk]            = useState(false);
  const [showGerir, setShowGerir]        = useState(false);
  const [gerirList, setGerirList]        = useState<Patologista[]>([]);
  const [gerirNovo, setGerirNovo]        = useState('');
  const [gerirTel, setGerirTel]          = useState('');

  const dataRef      = useRef<SemanaData | null>(null);
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekKeyRef   = useRef<string>('');

  // keep refs in sync
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { weekKeyRef.current = currentWeek; }, [currentWeek]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/patologistas').then(r => r.json()),
      fetch('/api/semanas?list=true').then(r => r.json()),
    ]).then(([pats, sems]: [Patologista[], string[]]) => {
      setPatologistas(pats);
      setSemanas(sems);
      if (pats.length > 0) setActiveTab(pats[0].nome);
    });

    const sat = getSaturday(new Date());
    setCurrentWeek(toIso(sat));
  }, []);

  // ── Load week ──────────────────────────────────────────────────────────────

  const loadWeek = useCallback(async (wk: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/semanas?week=${wk}`);
      const d: SemanaData = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentWeek) loadWeek(currentWeek);
  }, [currentWeek, loadWeek]);

  // ── Schedule helpers ───────────────────────────────────────────────────────

  function getSchedule(patId: string): PatologistaSchedule {
    return data?.patologistas.find(p => p.patologistaId === patId) ?? { patologistaId: patId, rows: [] };
  }

  function updateSchedule(patId: string, rows: LaudoRow[]) {
    setData(prev => {
      if (!prev) return { weekKey: weekKeyRef.current, patologistas: [{ patologistaId: patId, rows }] };
      const exists = prev.patologistas.some(p => p.patologistaId === patId);
      return {
        ...prev,
        patologistas: exists
          ? prev.patologistas.map(p => p.patologistaId === patId ? { ...p, rows } : p)
          : [...prev.patologistas, { patologistaId: patId, rows }],
      };
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1500);
  }

  async function doSave() {
    const toSave = dataRef.current;
    if (!toSave) return;
    setSaving(true);
    try {
      await fetch('/api/semanas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toSave, weekKey: weekKeyRef.current }),
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
      const sems: string[] = await fetch('/api/semanas?list=true').then(r => r.json());
      setSemanas(sems);
    } finally {
      setSaving(false);
    }
  }

  // ── Row operations ─────────────────────────────────────────────────────────

  function updateRow(patId: string, rowId: string, field: keyof LaudoRow, value: string) {
    const schedule = getSchedule(patId);
    const newRows = schedule.rows.map(r => r.id === rowId ? { ...r, [field]: value } : r);
    updateSchedule(patId, newRows);
    scheduleSave();
  }

  function addRow(patId: string) {
    const schedule = getSchedule(patId);
    updateSchedule(patId, [...schedule.rows, { id: uid(), status: 'Pendente', prioridade: 'Normal' }]);
  }

  function removeRow(patId: string, rowId: string) {
    const schedule = getSchedule(patId);
    updateSchedule(patId, schedule.rows.filter(r => r.id !== rowId));
    scheduleSave();
  }

  // ── Week navigation ────────────────────────────────────────────────────────

  function navigate(dir: -1 | 1) {
    const sat = parseDateLocal(currentWeek);
    setCurrentWeek(toIso(addDays(sat, dir * 7)));
  }

  function goToday() {
    setCurrentWeek(toIso(getSaturday(new Date())));
  }

  // ── Gerir patologistas ─────────────────────────────────────────────────────

  function openGerir() {
    setGerirList([...patologistas]);
    setGerirNovo('');
    setGerirTel('');
    setShowGerir(true);
  }

  function gerirRemove(nome: string) {
    setGerirList(prev => prev.filter(p => p.nome !== nome));
  }

  function gerirAdd() {
    const slug = gerirNovo.trim().toLowerCase().replace(/\s+/g, '.');
    if (!slug || gerirList.find(p => p.nome === slug)) return;
    setGerirList(prev => [...prev, { nome: slug, telefone: gerirTel.trim() }]);
    setGerirNovo('');
    setGerirTel('');
  }

  async function gerirSave() {
    await fetch('/api/patologistas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gerirList),
    });
    setPatologistas(gerirList);
    if (gerirList.length > 0 && !gerirList.find(p => p.nome === activeTab)) {
      setActiveTab(gerirList[0].nome);
    }
    setShowGerir(false);
  }

  const schedule      = getSchedule(activeTab);
  const todaySat      = toIso(getSaturday(new Date()));
  const isCurrentWeek = currentWeek === todaySat;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fp-layout">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(to right, #eff6ff, #eef2ff, #f5f3ff)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Left: back + title */}
        <Link href="/" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 13 }}>
          ← Voltar
        </Link>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-0)' }}>
          🗓 Escala Semanal de Laudos
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
          Registro de laudos por patologista, por final de semana
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Anterior</button>
          <div style={{
            padding: '5px 14px',
            background: isCurrentWeek ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${isCurrentWeek ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-xs)',
            fontSize: 13,
            fontWeight: 600,
            color: isCurrentWeek ? 'var(--blue)' : 'var(--text-0)',
            minWidth: 260,
            textAlign: 'center' as const,
          }}>
            {currentWeek ? displayWeek(currentWeek) : '—'}
            {isCurrentWeek && (
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                atual
              </span>
            )}
          </div>
          <button className="btn btn-ghost" onClick={() => navigate(1)}>Próxima →</button>
          {!isCurrentWeek && (
            <button className="btn btn-ghost" onClick={goToday} title="Ir para a semana atual">
              Hoje
            </button>
          )}
        </div>

        {/* Save indicator */}
        {saving && (
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>Salvando...</span>
        )}
        {savedOk && !saving && (
          <span style={{ fontSize: 12, color: '#16a34a', marginLeft: 4, fontWeight: 600 }}>✓ Salvo</span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div style={{
          width: 180,
          minWidth: 180,
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-3)' }}>
              Semanas
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {/* Current week always appears even if not yet saved */}
            {currentWeek && !semanas.includes(currentWeek) && (
              <SemanaItem
                weekKey={currentWeek}
                active={true}
                unsaved
                onClick={() => {}}
              />
            )}
            {semanas.map(wk => (
              <SemanaItem
                key={wk}
                weekKey={wk}
                active={wk === currentWeek}
                onClick={() => setCurrentWeek(wk)}
              />
            ))}
            {semanas.length === 0 && !currentWeek && (
              <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                Nenhum dado salvo
              </div>
            )}
          </div>
        </div>

        {/* ── Main ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>

          {/* Tabs */}
          <div className="fp-tabs">
            {patologistas.map(p => {
              const rows = getSchedule(p.nome).rows;
              return (
                <button
                  key={p.nome}
                  className={`fp-tab${activeTab === p.nome ? ' active' : ''}`}
                  onClick={() => setActiveTab(p.nome)}
                >
                  {nomeDisplay(p.nome)}
                  {rows.length > 0 && (
                    <span className="fp-tab-badge">{rows.length}</span>
                  )}
                </button>
              );
            })}
            <button
              className="fp-tab"
              onClick={openGerir}
              style={{ marginLeft: 'auto', gap: 4 }}
            >
              ⚙ Gerir Patologistas
            </button>
          </div>

          {/* Table panel */}
          <div className="fp-table-area" style={{ padding: '16px 20px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--text-3)' }}>
                <div className="animate-pulse-soft">Carregando...</div>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button className="btn btn-primary" onClick={() => addRow(activeTab)}>
                    + Adicionar Linha
                  </button>
                  <button className="btn btn-green" onClick={doSave} disabled={saving}>
                    {saving ? 'Salvando...' : '💾 Salvar'}
                  </button>
                  {schedule.rows.length > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-3)' }}>
                      {schedule.rows.length} laudo{schedule.rows.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {schedule.rows.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: 48,
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg-1)',
                    color: 'var(--text-3)',
                  }}>
                    <div style={{ fontSize: 28 }}>🔬</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-2)' }}>
                      Nenhum laudo para {nomeDisplay(activeTab)} neste final de semana
                    </div>
                    <div style={{ fontSize: 12 }}>Clique em "+ Adicionar Linha" para começar</div>
                  </div>
                ) : (
                  <div className="table-container" style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                    <table style={{ minWidth: 1080 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 110 }}>Protocolo</th>
                          <th style={{ minWidth: 160 }}>Paciente</th>
                          <th style={{ minWidth: 130 }}>Material</th>
                          <th style={{ width: 120 }}>Recebimento</th>
                          <th style={{ width: 110 }}>Prazo</th>
                          <th style={{ width: 120 }}>Prioridade</th>
                          <th style={{ width: 120 }}>Status</th>
                          <th style={{ minWidth: 200 }}>Laudo</th>
                          <th style={{ minWidth: 160 }}>Observações</th>
                          <th style={{ width: 48, position: 'sticky', right: 0, background: 'var(--bg-1)', zIndex: 3, boxShadow: '-2px 0 6px rgba(0,0,0,0.06)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.rows.map(row => (
                          <LaudoRowEditor
                            key={row.id}
                            row={row}
                            onChange={(field, value) => updateRow(activeTab, row.id, field, value)}
                            onRemove={() => removeRow(activeTab, row.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Gerir Patologistas Modal ─────────────────────────────────────── */}
      {showGerir && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGerir(false); }}
        >
          <div className="animate-scale-in" style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)', padding: 24, width: 460, maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-0)', marginBottom: 4 }}>⚙ Gerir Patologistas</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 18 }}>Adicione, renomeie ou remova patologistas da escala.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {gerirList.map(p => (
                <div key={p.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', transition: 'all 0.15s' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(to right, var(--blue), var(--indigo))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {nomeDisplay(p.nome).charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-0)', fontSize: 13 }}>{nomeDisplay(p.nome)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.telefone || 'sem telefone'}</div>
                  </div>
                  <button className="btn btn-red btn-sm btn-icon" onClick={() => gerirRemove(p.nome)} title="Remover">✕</button>
                </div>
              ))}
              {gerirList.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius-xs)' }}>
                  Nenhum patologista cadastrado
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', marginBottom: 10 }}>
                Adicionar patologista
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Nome (ex: joao.silva)"
                  value={gerirNovo}
                  onChange={e => setGerirNovo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && gerirAdd()}
                  style={modalInputStyle}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Telefone (opcional, ex: 5561...)"
                    value={gerirTel}
                    onChange={e => setGerirTel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && gerirAdd()}
                    style={{ ...modalInputStyle, flex: 1 }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={gerirAdd}>+ Adicionar</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowGerir(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={gerirSave}>Salvar alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SemanaItem (sidebar button) ───────────────────────────────────────────────

function SemanaItem({ weekKey, active, unsaved, onClick }: { weekKey: string; active: boolean; unsaved?: boolean; onClick: () => void }) {
  const sat = parseDateLocal(weekKey);
  const sun = addDays(sat, 1);
  const month = sat.toLocaleString('pt-BR', { month: 'short' });
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        padding: '8px 14px',
        background: active ? 'var(--blue-bg)' : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${active ? 'var(--blue)' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--blue)' : 'var(--text-2)', letterSpacing: '0.3px' }}>
        {month.toUpperCase()} {sat.getFullYear()}
        {unsaved && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--text-3)', fontWeight: 500 }}>nova</span>}
      </span>
      <span style={{ fontSize: 12, color: active ? 'var(--blue)' : 'var(--text-3)' }}>
        {sat.getDate().toString().padStart(2, '0')}/{(sat.getMonth()+1).toString().padStart(2,'0')}
        {' – '}
        {sun.getDate().toString().padStart(2, '0')}/{(sun.getMonth()+1).toString().padStart(2,'0')}
      </span>
    </button>
  );
}

// ── LaudoRowEditor ────────────────────────────────────────────────────────────

const cellInput: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  width: '100%',
  fontSize: 13,
  color: 'var(--text-0)',
  padding: '3px 4px',
  borderRadius: 4,
  outline: 'none',
  transition: 'background 0.15s, box-shadow 0.15s',
};

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xs)',
  fontSize: 13,
  color: 'var(--text-0)',
  outline: 'none',
};

interface RowEditorProps {
  row: LaudoRow;
  onChange: (field: keyof LaudoRow, value: string) => void;
  onRemove: () => void;
}

function LaudoRowEditor({ row, onChange, onRemove }: RowEditorProps) {
  const prioStyle  = PRIO_STYLE[row.prioridade ?? 'Normal']  ?? PRIO_STYLE['Normal'];
  const statStyle  = STATUS_STYLE[row.status ?? 'Pendente']  ?? STATUS_STYLE['Pendente'];

  const selectStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    ...cellInput,
    ...extra,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 12,
    padding: '3px 6px',
    border: `1px solid ${extra.borderColor}`,
    background: extra.background as string,
    borderRadius: 20,
    appearance: 'none' as const,
    WebkitAppearance: 'none',
  });

  return (
    <tr>
      <td>
        <CellInput value={row.protocolo ?? ''} onChange={v => onChange('protocolo', v)} placeholder="—" />
      </td>
      <td>
        <CellInput value={row.nom_paciente ?? ''} onChange={v => onChange('nom_paciente', v)} placeholder="Nome do paciente" />
      </td>
      <td>
        <CellInput value={row.tipo_material ?? ''} onChange={v => onChange('tipo_material', v)} placeholder="Material" />
      </td>
      <td>
        <input
          type="date"
          style={{ ...cellInput, fontSize: 12 }}
          value={row.dta_recebimento ?? ''}
          onChange={e => onChange('dta_recebimento', e.target.value)}
          onFocus={e => { (e.target as HTMLInputElement).style.background = 'rgba(59,130,246,0.06)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.background = 'transparent'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
        />
      </td>
      <td>
        <input
          type="date"
          style={{ ...cellInput, fontSize: 12 }}
          value={row.prazo ?? ''}
          onChange={e => onChange('prazo', e.target.value)}
          onFocus={e => { (e.target as HTMLInputElement).style.background = 'rgba(59,130,246,0.06)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.background = 'transparent'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
        />
      </td>
      <td>
        <select
          style={selectStyle(prioStyle)}
          value={row.prioridade ?? 'Normal'}
          onChange={e => onChange('prioridade', e.target.value)}
        >
          <option value="Normal">Normal</option>
          <option value="Urgente">Urgente</option>
          <option value="Urgentíssimo">Urgentíssimo</option>
        </select>
      </td>
      <td>
        <select
          style={selectStyle(statStyle)}
          value={row.status ?? 'Pendente'}
          onChange={e => onChange('status', e.target.value)}
        >
          <option value="Pendente">Pendente</option>
          <option value="Em análise">Em análise</option>
          <option value="Concluído">Concluído</option>
          <option value="Revisão">Revisão</option>
        </select>
      </td>
      <td>
        <CellInput value={row.laudo ?? ''} onChange={v => onChange('laudo', v)} placeholder="Laudo..." />
      </td>
      <td>
        <CellInput value={row.observacoes ?? ''} onChange={v => onChange('observacoes', v)} placeholder="Obs..." />
      </td>
      <td style={{ textAlign: 'center', padding: '4px 6px', position: 'sticky', right: 0, background: 'var(--bg-1)', boxShadow: '-2px 0 6px rgba(0,0,0,0.06)' }}>
        <button
          onClick={onRemove}
          title="Excluir linha"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-xs)',
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'var(--red-bg)',
            color: '#dc2626',
            cursor: 'pointer',
            fontSize: 14,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            const t = e.currentTarget;
            t.style.background = 'rgba(239,68,68,0.18)';
            t.style.borderColor = 'rgba(239,68,68,0.5)';
            t.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={e => {
            const t = e.currentTarget;
            t.style.background = 'var(--red-bg)';
            t.style.borderColor = 'rgba(239,68,68,0.25)';
            t.style.transform = 'scale(1)';
          }}
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

// ── CellInput — transparent inline input with focus highlight ─────────────────

function CellInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      style={{
        ...cellInput,
        background: focused ? 'rgba(59,130,246,0.06)' : 'transparent',
        boxShadow: focused ? '0 0 0 2px rgba(59,130,246,0.15)' : 'none',
      }}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}
