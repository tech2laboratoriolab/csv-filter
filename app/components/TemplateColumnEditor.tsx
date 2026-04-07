'use client';

import type { TemplateColumn, ColumnDef } from '@/lib/clientDb';

interface TemplateColumnEditorProps {
  templateColumns: TemplateColumn[];
  columns: ColumnDef[];
  selectedCols: string[];
  onChange: (cols: TemplateColumn[]) => void;
}

export default function TemplateColumnEditor({
  templateColumns,
  columns,
  selectedCols,
  onChange,
}: TemplateColumnEditorProps) {
  const update = (i: number, field: string, val: unknown) => {
    const next = [...templateColumns];
    (next[i] as unknown as Record<string, unknown>)[field] = val;
    onChange(next);
  };

  const remove = (i: number) => onChange(templateColumns.filter((_, j) => j !== i));

  const addTemplate = () => {
    onChange([
      ...templateColumns,
      {
        id: Date.now().toString() + Math.random(),
        label: `Mensagem ${templateColumns.length + 1}`,
        template: '',
        width: 280,
      },
    ]);
  };

  const varList = selectedCols
    .map(name => {
      const col = columns.find(c => c.name === name);
      return `{${name}}${col ? ` — ${col.label}` : ''}`;
    })
    .join(', ');

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          marginBottom: 12,
          padding: '8px 10px',
          background: 'var(--bg-2)',
          borderRadius: 4,
          lineHeight: 1.6,
          border: '1px solid var(--border)',
        }}
      >
        <strong style={{ color: 'var(--text-2)' }}>Colunas de mensagem</strong> interpolam
        variáveis <code style={{ color: 'var(--yellow)' }}>{'{nome_coluna}'}</code> com os valores
        de cada linha.
        <br />
        <strong style={{ color: 'var(--text-2)' }}>Variáveis disponíveis:</strong>{' '}
        <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{varList}</span>
      </div>

      {templateColumns.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            color: 'var(--text-3)',
            fontSize: 13,
          }}
        >
          Sem colunas de mensagem.
        </div>
      )}

      {templateColumns.map((tc, i) => (
        <div key={tc.id} className="rule-card">
          <div className="rule-card-header">
            <input
              className="rule-name-input"
              value={tc.label}
              onChange={e => update(i, 'label', e.target.value)}
              placeholder="Label da coluna"
            />
            <button className="btn btn-sm btn-icon btn-red" onClick={() => remove(i)}>
              ✕
            </button>
          </div>
          <div className="rule-card-body">
            <div className="rule-row" style={{ alignItems: 'flex-start' }}>
              <label style={{ paddingTop: 4 }}>Template</label>
              <textarea
                value={tc.template}
                onChange={e => update(i, 'template', e.target.value)}
                rows={6}
                placeholder="Prezado Parceiro,&#10;&#10;Laudo do(a) Paciente {cod_requisicao} - {nom_paciente} está disponível."
                style={{
                  flex: 1,
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  background: 'var(--bg-2)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '6px 8px',
                  lineHeight: 1.5,
                }}
              />
            </div>
            <div className="rule-row">
              <label>Após col.</label>
              <select
                value={tc.insertAfterColumn || ''}
                onChange={e => update(i, 'insertAfterColumn', e.target.value || undefined)}
              >
                <option value="">— No final —</option>
                {selectedCols.map(name => {
                  const col = columns.find(c => c.name === name);
                  return (
                    <option key={name} value={name}>
                      {col?.label ?? name}
                    </option>
                  );
                })}
              </select>
              <label style={{ marginLeft: 8 }}>Largura</label>
              <input
                type="number"
                value={tc.width ?? 280}
                onChange={e => update(i, 'width', parseInt(e.target.value) || 280)}
                style={{ width: 70 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>px</span>
            </div>
          </div>
        </div>
      ))}

      <button className="btn btn-yellow btn-sm" style={{ marginTop: 8 }} onClick={addTemplate}>
        + Nova Coluna de Mensagem
      </button>
    </div>
  );
}
