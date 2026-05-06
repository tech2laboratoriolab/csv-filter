"use client";

import { useEffect, useState } from "react";

interface Tarefa {
  codRequisicao: string;
  codTarefa: number;
  codTarefaTipo: string | null;
  dtaLimite: string | null;
  dtaInclusao: string | null;
  msgTarefa: string;
  remetente: string;
  destinatario: string;
}

interface TarefaModalProps {
  codRequisicao: string;
  onClose: () => void;
}

function formatDateTime(val: string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

export default function TarefaModal({
  codRequisicao,
  onClose,
}: TarefaModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/tarefas?codRequisicao=${encodeURIComponent(codRequisicao)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(d.error ?? "Erro desconhecido"));
        return res.json();
      })
      .then((data: Tarefa[]) => {
        if (!cancelled) setTarefas(data);
      })
      .catch((err) => {
        if (cancelled || (err instanceof Error && err.name === "AbortError"))
          return;
        setError(typeof err === "string" ? err : "Falha ao carregar tarefas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [codRequisicao]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: "100%",
          maxWidth: 660,
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--bg-0)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 19,
                  color: "var(--text-0)",
                }}
              >
                Tarefa
              </span>
              <span
                style={{
                  marginLeft: 10,
                  fontFamily: "monospace",
                  fontSize: 15,
                  color: "var(--text-1)",
                  background: "var(--bg-3)",
                  padding: "3px 9px",
                  borderRadius: 4,
                }}
              >
                {codRequisicao}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            aria-label="Fechar"
            style={{ fontSize: 18, padding: "4px 10px" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: "auto",
            padding: "16px 18px",
            flexGrow: 1,
            background: "var(--bg-0)",
          }}
        >
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--bg-1)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 10,
                      gap: 8,
                    }}
                  >
                    <div
                      className="animate-shimmer"
                      style={{ height: 14, width: "45%", borderRadius: 4 }}
                    />
                    <div
                      className="animate-shimmer"
                      style={{ height: 14, width: "28%", borderRadius: 4 }}
                    />
                  </div>
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      marginBottom: 10,
                    }}
                  />
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div
                      className="animate-shimmer"
                      style={{ height: 12, width: "100%", borderRadius: 4 }}
                    />
                    <div
                      className="animate-shimmer"
                      style={{ height: 12, width: "85%", borderRadius: 4 }}
                    />
                    <div
                      className="animate-shimmer"
                      style={{ height: 12, width: "60%", borderRadius: 4 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                color: "var(--red)",
                background: "var(--red-bg)",
                border: "1px solid var(--red)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && tarefas.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "var(--text-2)",
                padding: 40,
                fontSize: 14,
              }}
            >
              Nenhuma tarefa encontrada
            </div>
          )}

          {!loading && !error && tarefas.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tarefas.map((t, idx) => (
                <div
                  key={t.codTarefa}
                  style={{
                    background: "var(--bg-1)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 13,
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          background: "var(--blue-bg)",
                          color: "var(--blue)",
                          borderRadius: 4,
                          padding: "1px 7px",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--text-0)" }}>
                        {t.remetente}
                      </span>
                      <span style={{ color: "var(--text-3)", fontSize: 13 }}>
                        →
                      </span>
                      <span style={{ fontWeight: 500, color: "var(--text-1)" }}>
                        {t.destinatario}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {t.codTarefaTipo && (
                        <span
                          style={{
                            color: "var(--text-2)",
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}
                        >
                          tipo/classificação:{" "}
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--text-1)",
                              background: "var(--bg-3)",
                              padding: "2px 7px",
                              borderRadius: 4,
                            }}
                          >
                            {t.codTarefaTipo}
                          </span>
                        </span>
                      )}
                      <span
                        style={{
                          color: "var(--text-1)",
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                          background: "var(--bg-3)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDateTime(t.dtaInclusao)}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      marginBottom: 8,
                    }}
                  />

                  {/* Message */}
                  <div
                    style={{
                      color: "var(--text-1)",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                      fontSize: 13,
                    }}
                  >
                    {t.msgTarefa || (
                      <em style={{ color: "var(--text-3)" }}>Sem mensagem</em>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
