'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Nota {
  id: number;
  texto: string;
  created_at: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function NotesClient() {
  const [notas, setNotas]       = useState<Nota[]>([]);
  const [texto, setTexto]       = useState('');
  const [busca, setBusca]       = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/anotacoes/notes')
      .then(r => r.json())
      .then((data: Nota[]) => { setNotas(data); setLoading(false); });
  }, []);

  async function handleSave() {
    const t = texto.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      if (editingId !== null) {
        const res = await fetch('/api/anotacoes/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, texto: t }),
        });
        if (!res.ok) throw new Error('Erro ao salvar');
        const atualizada: Nota = await res.json();
        setNotas(prev => prev.map(n => n.id === editingId ? atualizada : n));
        setEditingId(null);
      } else {
        const res = await fetch('/api/anotacoes/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: t }),
        });
        if (!res.ok) throw new Error('Erro ao salvar');
        const nova: Nota = await res.json();
        setNotas(prev => [nova, ...prev]);
      }
      setTexto('');
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(nota: Nota) {
    setEditingId(nota.id);
    setTexto(nota.texto);
    inputRef.current?.focus();
  }

  function handleCancelEdit() {
    setEditingId(null);
    setTexto('');
    inputRef.current?.focus();
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await fetch(`/api/anotacoes/notes?id=${id}`, { method: 'DELETE' });
      setNotas(prev => prev.filter(n => n.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setTexto('');
      }
    } finally {
      setDeleting(null);
    }
  }

  const notasFiltradas = notas.filter(n =>
    n.texto.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="fp-layout">

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
          📝 Notas
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
          Anotações rápidas de texto
        </span>
      </div>

      {/* Body — two-column layout */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        padding: '24px',
        background: 'var(--bg-0)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gridTemplateRows: '1fr',
          gap: 24,
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
          className="notes-layout"
        >

          {/* Left column — editor */}
          <div style={{
            background: 'var(--bg-1)',
            border: editingId !== null ? '1px solid var(--blue)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 16,
            boxShadow: 'var(--shadow-sm)',
            transition: 'border-color 0.15s',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            boxSizing: 'border-box',
          }}>
            {editingId !== null && (
              <div style={{ fontSize: 11, color: 'var(--blue)', marginBottom: 8, fontWeight: 600 }}>
                Editando nota
              </div>
            )}
            <textarea
              ref={inputRef}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
                if (e.key === 'Escape' && editingId !== null) handleCancelEdit();
              }}
              placeholder="Escreva uma nota... (Ctrl+Enter para salvar)"
              style={{
                flex: 1,
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-0)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                fontSize: 13,
                color: 'var(--text-0)',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                marginBottom: 20,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {editingId !== null && (
                <button
                  className="btn btn-ghost btn-lg"
                  onClick={handleCancelEdit}
                  style={{ padding: '12px 24px', fontSize: 14 }}
                >
                  Cancelar edição
                </button>
              )}
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSave}
                disabled={saving || !texto.trim()}
                style={{ padding: '12px 24px', fontSize: 14 }}
              >
                {saving ? 'Salvando...' : editingId !== null ? '✓ Salvar edição' : '+ Adicionar nota'}
              </button>
            </div>
          </div>

          {/* Right column — list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

            {/* Search bar + note count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 13, color: 'var(--text-3)', pointerEvents: 'none',
              }}>
                🔍
              </span>
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Pesquisar notas..."
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 34px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  color: 'var(--text-0)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--blue)',
                background: 'var(--blue-bg)',
                border: '1px solid var(--blue)',
                borderRadius: 'var(--radius-xs)',
                padding: '4px 10px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
              </span>
            </div>

            {/* Notes list */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                Carregando...
              </div>
            ) : notas.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, padding: 48, border: '2px dashed var(--border)',
                borderRadius: 'var(--radius)', background: 'var(--bg-1)', color: 'var(--text-3)',
              }}>
                <div style={{ fontSize: 28 }}>📝</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-2)' }}>
                  Nenhuma nota ainda
                </div>
                <div style={{ fontSize: 12 }}>Escreva algo ao lado para começar</div>
              </div>
            ) : notasFiltradas.length === 0 ? (
              <div style={{
                textAlign: 'center', color: 'var(--text-3)', padding: 40,
                border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                background: 'var(--bg-1)',
              }}>
                Nenhuma nota encontrada para &ldquo;{busca}&rdquo;
              </div>
            ) : (
              notasFiltradas.map(nota => (
                <div
                  key={nota.id}
                  style={{
                    background: editingId === nota.id ? 'var(--blue-bg)' : 'var(--bg-1)',
                    border: editingId === nota.id ? '1px solid var(--blue)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      color: 'var(--text-0)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.6,
                    }}>
                      {nota.texto}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                      {fmtDate(nota.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => { setConfirmDelete(null); handleEdit(nota); }}
                      title="Editar nota"
                      disabled={deleting === nota.id}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z"/>
                      </svg>
                    </button>

                    {confirmDelete === nota.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          Excluir?
                        </span>
                        <button
                          className="btn btn-red btn-sm"
                          onClick={() => { setConfirmDelete(null); handleDelete(nota.id); }}
                          disabled={deleting === nota.id}
                          style={{ padding: '3px 10px', fontSize: 11 }}
                        >
                          Sim
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirmDelete(null)}
                          style={{ padding: '3px 10px', fontSize: 11 }}
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                    <button
                      className="btn btn-red btn-sm btn-icon"
                      onClick={() => setConfirmDelete(nota.id)}
                      disabled={deleting === nota.id}
                      title="Excluir nota"
                    >
                      {deleting === nota.id ? '...' : '✕'}
                    </button>
                    )}
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .notes-layout {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
