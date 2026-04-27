import Link from 'next/link';

export default function AnotacoesPage() {
  return (
    <div className="fp-layout">
      <style>{`
        .anot-card {
          width: 220px;
          padding: 32px 24px;
          background: var(--bg-1);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: box-shadow 0.15s, border-color 0.15s;
          text-decoration: none;
        }
        .anot-card:hover {
          border-color: rgba(99,102,241,0.4);
          box-shadow: var(--shadow-md);
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
        <Link href="/" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 13 }}>
          ← Voltar
        </Link>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-0)' }}>
          Anotações
        </span>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-0)',
        padding: 32,
      }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>

          <Link href="/anotacoes/semanas" className="anot-card">
            <span style={{ fontSize: 40 }}>🗓</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-0)' }}>Escala Semanal</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
              Registro de laudos por patologista por final de semana
            </span>
          </Link>

          <Link href="/anotacoes/notes" className="anot-card">
            <span style={{ fontSize: 40 }}>📝</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-0)' }}>Notas</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
              Anotações rápidas de texto livre
            </span>
          </Link>

        </div>
      </div>
    </div>
  );
}
