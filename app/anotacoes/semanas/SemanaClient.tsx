'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useTrack } from '@/lib/useTrack';

// ── Types ────────────────────────────────────────────────────────────────────

interface Patologista {
  nome: string;
}

interface PatologistaSchedule {
  patologistaId: string;
  req: number;
  top: number;
  lam: number;
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

/** Migrate old format (rows[]) → new format (req/top/lam) */
function normalizeSchedule(raw: Record<string, unknown>): PatologistaSchedule {
  return {
    patologistaId: raw.patologistaId as string,
    req: typeof raw.req === 'number' ? raw.req : 0,
    top: typeof raw.top === 'number' ? raw.top : 0,
    lam: typeof raw.lam === 'number' ? raw.lam : 0,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SemanaClient() {
  const { track } = useTrack();
  const [patologistas, setPatologistas] = useState<Patologista[]>([]);
  const [semanas, setSemanas]           = useState<string[]>([]);
  const [currentWeek, setCurrentWeek]  = useState<string>('');
  const [data, setData]                = useState<SemanaData | null>(null);
  const [loading, setLoading]          = useState(false);
  const [saving, setSaving]            = useState(false);
  const [savedOk, setSavedOk]          = useState(false);
  const [showGerir, setShowGerir]      = useState(false);
  const [gerirList, setGerirList]      = useState<Patologista[]>([]);
  const [gerirNovo, setGerirNovo]      = useState('');

  const dataRef    = useRef<SemanaData | null>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekKeyRef = useRef<string>('');

  // keep refs in sync
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { weekKeyRef.current = currentWeek; }, [currentWeek]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/patologistas').then(r => r.json()),
      fetch('/api/anotacoes/semanas?list=true').then(r => r.json()),
    ]).then(([pats, sems]: [Patologista[], string[]]) => {
      setPatologistas(pats);
      setSemanas(sems);
    });
    setCurrentWeek(toIso(getSaturday(new Date())));
  }, []);

  // ── Load week ──────────────────────────────────────────────────────────────

  const loadWeek = useCallback(async (wk: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anotacoes/semanas?week=${wk}`);
      const raw = await res.json();
      const normalized: SemanaData = {
        weekKey: raw.weekKey,
        patologistas: (raw.patologistas ?? []).map(normalizeSchedule),
      };
      setData(normalized);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentWeek) loadWeek(currentWeek);
  }, [currentWeek, loadWeek]);

  // ── Schedule helpers ───────────────────────────────────────────────────────

  function getSchedule(patId: string): PatologistaSchedule {
    return data?.patologistas.find(p => p.patologistaId === patId) ?? { patologistaId: patId, req: 0, top: 0, lam: 0 };
  }

  function updateField(patId: string, field: 'req' | 'top' | 'lam', value: number) {
    setData(prev => {
      const base: SemanaData = prev ?? { weekKey: weekKeyRef.current, patologistas: [] };
      const exists = base.patologistas.some(p => p.patologistaId === patId);
      return {
        ...base,
        patologistas: exists
          ? base.patologistas.map(p => p.patologistaId === patId ? { ...p, [field]: value } : p)
          : [...base.patologistas, { patologistaId: patId, req: 0, top: 0, lam: 0, [field]: value }],
      };
    });
    scheduleSave();
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
      await fetch('/api/anotacoes/semanas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toSave, weekKey: weekKeyRef.current }),
      });
      track("schedule_saved", { week: weekKeyRef.current });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
      const sems: string[] = await fetch('/api/anotacoes/semanas?list=true').then(r => r.json());
      setSemanas(sems);
    } finally {
      setSaving(false);
    }
  }

  // ── Week navigation ────────────────────────────────────────────────────────

  function navigate(dir: -1 | 1) {
    const newWeek = toIso(addDays(parseDateLocal(currentWeek), dir * 7));
    track("week_navigated", { direction: dir === 1 ? "next" : "prev", week: newWeek });
    setCurrentWeek(newWeek);
  }

  function goToday() {
    setCurrentWeek(toIso(getSaturday(new Date())));
  }

  // ── Gerir patologistas ─────────────────────────────────────────────────────

  function openGerir() {
    setGerirList([...patologistas]);
    setGerirNovo('');
    setShowGerir(true);
  }

  function gerirRemove(nome: string) {
    setGerirList(prev => prev.filter(p => p.nome !== nome));
  }

  function gerirAdd() {
    const slug = gerirNovo.trim().toLowerCase().replace(/\s+/g, '.');
    if (!slug || gerirList.find(p => p.nome === slug)) return;
    setGerirList(prev => [...prev, { nome: slug }]);
    setGerirNovo('');
  }

  async function gerirSave() {
    try {
      const res = await fetch('/api/patologistas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gerirList),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      setPatologistas(gerirList);
      setShowGerir(false);
    } catch {
      alert('Erro ao salvar lista de patologistas. Tente novamente.');
    }
  }

  const todaySat      = toIso(getSaturday(new Date()));
  const isCurrentWeek = currentWeek === todaySat;

  // Totals
  const totalReq = patologistas.reduce((s, p) => s + getSchedule(p.nome).req, 0);
  const totalLam = patologistas.reduce((s, p) => s + getSchedule(p.nome).lam, 0);

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
                isCurrent={currentWeek === todaySat}
                unsaved
                onClick={() => {}}
              />
            )}
            {semanas.map(wk => (
              <SemanaItem
                key={wk}
                weekKey={wk}
                active={wk === currentWeek}
                isCurrent={wk === todaySat}
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
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-0)' }}>

          {/* Barra de ações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-ghost" onClick={openGerir}>⚙ Gerir Patologistas</button>
            <button className="btn btn-primary" onClick={doSave} disabled={saving}>
              {saving ? 'Salvando...' : '💾 Salvar'}
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-3)' }}>
              Carregando...
            </div>
          ) : patologistas.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: 48, border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
              background: 'var(--bg-1)', color: 'var(--text-3)',
            }}>
              <div style={{ fontSize: 28 }}>🔬</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-2)' }}>
                Nenhum patologista cadastrado
              </div>
              <div style={{ fontSize: 12 }}>Clique em "⚙ Gerir Patologistas" para adicionar</div>
            </div>
          ) : (
            <div className="table-container" style={{
              background: 'var(--bg-1)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden',
              maxWidth: 600,
            }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Patologista</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Req.</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Lâm.</th>
                  </tr>
                </thead>
                <tbody>
                  {patologistas.map(p => {
                    const s = getSchedule(p.nome);
                    return (
                      <tr key={p.nome}>
                        <td style={{ fontWeight: 500 }}>{nomeDisplay(p.nome)}</td>
                        <td><NumberCell value={s.req} onChange={v => updateField(p.nome, 'req', v)} /></td>
                        <td><NumberCell value={s.lam} onChange={v => updateField(p.nome, 'lam', v)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-0)' }}>TOTAL:</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-0)' }}>{totalReq}</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-0)' }}>{totalLam}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
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
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Nome (ex: joao.silva)"
                  value={gerirNovo}
                  onChange={e => setGerirNovo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && gerirAdd()}
                  style={{ ...modalInputStyle, flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" onClick={gerirAdd}>+ Adicionar</button>
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

function SemanaItem({ weekKey, active, isCurrent, unsaved, onClick }: { weekKey: string; active: boolean; isCurrent?: boolean; unsaved?: boolean; onClick: () => void }) {
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
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: active ? 'var(--blue)' : 'var(--text-2)', letterSpacing: '0.3px' }}>
        {month.toUpperCase()} {sat.getFullYear()}
        {isCurrent && (
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--blue)',
            flexShrink: 0,
          }} title="Semana atual" />
        )}
        {unsaved && <span style={{ marginLeft: 2, fontSize: 9, color: 'var(--text-3)', fontWeight: 500 }}>nova</span>}
      </span>
      <span style={{ fontSize: 12, color: active ? 'var(--blue)' : 'var(--text-3)' }}>
        {sat.getDate().toString().padStart(2, '0')}/{(sat.getMonth()+1).toString().padStart(2,'0')}
        {' – '}
        {sun.getDate().toString().padStart(2, '0')}/{(sun.getMonth()+1).toString().padStart(2,'0')}
      </span>
    </button>
  );
}

// ── NumberCell — inline numeric input ─────────────────────────────────────────

function NumberCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={e => onChange(Number(e.target.value) || 0)}
      style={{
        width: '100%',
        textAlign: 'center',
        border: 'none',
        background: 'transparent',
        fontSize: 13,
        color: 'var(--text-0)',
        padding: '4px 6px',
        outline: 'none',
      }}
      onFocus={e => { e.target.style.background = 'rgba(59,130,246,0.06)'; }}
      onBlur={e => { e.target.style.background = 'transparent'; }}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
