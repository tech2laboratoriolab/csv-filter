'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPrompts, savePrompt, deletePrompt, type Prompt, COLUMNS } from '@/lib/clientDb';

export default function PromptConfigPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptsSource, setPromptsSource] = useState<'drive' | 'local' | null>(null);

  useEffect(() => {
    fetch('/api/prompts')
      .then((r) => r.json())
      .then((d) => setPromptsSource(d.source ?? null))
      .catch(() => {});

    getPrompts()
      .then((p) => setPrompts(p))
      .catch(() => setError('Erro ao carregar prompts'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.text.trim()) {
      setError('Nome e texto do prompt são obrigatórios');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePrompt(editing);
      const updated = await getPrompts();
      setPrompts(updated);
      setEditing(null);
    } catch {
      setError('Erro ao salvar prompt');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este prompt?')) return;
    try {
      await deletePrompt(id);
      const updated = await getPrompts();
      setPrompts(updated);
    } catch {
      setError('Erro ao excluir prompt');
    }
  };

  const startEdit = (prompt: Prompt) => {
    setEditing({ ...prompt });
    setError(null);
  };

  const startNew = () => {
    setEditing({
      id: `prompt-${Date.now()}`,
      name: '',
      description: '',
      text: '',
      createdAt: new Date().toISOString(),
    });
    setError(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(to right, #eff6ff, #eef2ff, #f5f3ff)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
      }}>
        <Link href="/anotacoes/analise-ia" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 13 }}>
          ← Voltar
        </Link>
        <span style={{ fontWeight: 700, fontSize: 16 }}>⚙️ Configuração de Prompts</span>
        {promptsSource && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 10px',
            borderRadius: 999,
            background: promptsSource === 'drive' ? '#dcfce7' : '#fef9c3',
            color: promptsSource === 'drive' ? '#15803d' : '#92400e',
            border: `1px solid ${promptsSource === 'drive' ? '#86efac' : '#fde68a'}`,
          }}>
            {promptsSource === 'drive' ? '● Google Drive' : '● Arquivo local'}
          </span>
        )}
      </div>

      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Lista de Prompts */}
        {!editing && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Prompts ({prompts.length})</span>
              <button
                onClick={startNew}
                style={{
                  padding: '6px 14px',
                  background: 'var(--blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Novo Prompt
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Carregando...</div>
            ) : prompts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                Nenhum prompt encontrado
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {prompts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--bg-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 300,
                      flex: '1 1 300px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 10 }}>
                      <button
                        onClick={() => startEdit(p)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          background: 'var(--bg-3)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: 'var(--text-2)',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: '#b91c1c',
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{p.description || 'Sem descrição'}</span>
                        {p.defaultColumn && (
                          <span style={{
                            fontSize: 11,
                            background: '#ede9fe',
                            color: '#6d28d9',
                            padding: '1px 8px',
                            borderRadius: 999,
                            fontWeight: 600,
                          }}>
                            col: {p.defaultColumn}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-1)',
                        background: 'var(--bg-2)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        maxHeight: 80,
                        overflow: 'auto',
                      }}>
                        {p.text.slice(0, 200)}{p.text.length > 200 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Editor */}
        {editing && (
          <div style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            height: 'calc(100vh - 96px)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {editing.createdAt ? 'Editar Prompt' : 'Novo Prompt'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setEditing(null)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: 'var(--text-2)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    background: 'var(--blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                    fontWeight: 600,
                  }}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
              {/* Coluna esquerda: campos */}
              <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Ex: Revisor de Contradições"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-0)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Ex: Analisa o laudo e identifica contradições internas"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-0)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                    Coluna padrão
                  </label>
                  <select
                    value={editing.defaultColumn ?? ''}
                    onChange={(e) => setEditing({ ...editing, defaultColumn: e.target.value || undefined })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-0)',
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  >
                    <option value="">— nenhuma —</option>
                    {COLUMNS.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Nome da coluna pré-selecionada ao escolher este prompt (opcional)
                  </div>
                </div>
              </div>

              {/* Coluna direita: textarea */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>
                  Texto do Prompt *
                </label>
                <textarea
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  placeholder="Digite o prompt aqui. Use {laudo} para indicar onde o texto do laudo será inserido."
                  style={{
                    flex: 1,
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-0)',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    resize: 'none',
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  Use {'{laudo}'} para indicar onde o texto do laudo será inserido
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
