"use client";

import { useState, useEffect, useMemo } from "react";
import { getDistinctClinics } from "@/lib/clientDb";
import { getVipPartners, setVipPartners } from "@/lib/vip";

interface Props {
  onClose: () => void;
  onSave: () => void;
}

export default function VipModal({ onClose, onSave }: Props) {
  const [clinics, setClinics] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isVip = typeof document !== "undefined" &&
    document.documentElement.classList.contains("vip-active");

  useEffect(() => {
    getDistinctClinics().then((all) => {
      setClinics(all);
      setSelected(new Set(getVipPartners()));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () =>
      search.trim()
        ? clinics.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
        : clinics,
    [clinics, search],
  );

  const toggle = (clinic: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(clinic) ? next.delete(clinic) : next.add(clinic);
      return next;
    });

  const selectAll = () =>
    setSelected((prev) => new Set([...Array.from(prev), ...filtered]));

  const clearAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => next.delete(c));
      return next;
    });

  const handleSave = () => {
    setVipPartners(Array.from(selected));
    onSave();
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c));

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 500 }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)",
            borderBottom: "1px solid rgba(29, 78, 216, 0.35)",
            padding: "18px 20px 14px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, color: "#93c5fd" }}>★</span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#f0f6ff",
                  letterSpacing: "-0.2px",
                }}
              >
                Clínicas Parceiras VIP
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#93c5fd", margin: 0, opacity: 0.9 }}>
              Somente registros dessas clínicas são exibidos no Modo VIP.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 8,
              color: "#bfdbfe",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: "4px 8px",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)")
            }
          >
            ×
          </button>
        </div>

        {/* ── Search ── */}
        <div style={{ padding: "18px 16px 0", position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 30,
              top: "50%",
              transform: "translateY(-30%)",
              color: "var(--text-3)",
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            className="modal-input"
            placeholder="Buscar clínica..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{
              margin: 0,
              width: "100%",
              paddingLeft: 34,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* ── Quick actions ── */}
        <div
          style={{
            padding: "10px 16px 6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {loading
              ? "Carregando..."
              : `${filtered.length} clínica${filtered.length !== 1 ? "s" : ""}${search ? " encontrada" + (filtered.length !== 1 ? "s" : "") : ""}`}
          </span>
          {!loading && filtered.length > 0 && (
            <button
              onClick={allFilteredSelected ? clearAll : selectAll}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                color: "var(--blue)",
                padding: "2px 0",
                fontWeight: 500,
              }}
            >
              {allFilteredSelected ? "Desmarcar todas" : "Selecionar todas"}
            </button>
          )}
        </div>

        {/* ── List ── */}
        <div
          style={{
            maxHeight: 280,
            overflowY: "auto",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            margin: "0",
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: 32,
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              <span className="spinner" />
              Carregando clínicas...
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--text-3)",
                padding: "32px 20px",
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>
                🏥
              </div>
              {clinics.length === 0
                ? "Nenhuma clínica encontrada nos dados"
                : "Nenhuma clínica corresponde à busca"}
            </div>
          ) : (
            filtered.map((clinic, i) => {
              const isSelected = selected.has(clinic);
              return (
                <label
                  key={clinic}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    cursor: "pointer",
                    borderLeft: isSelected
                      ? "3px solid #1d4ed8"
                      : "3px solid transparent",
                    background: isSelected
                      ? "rgba(29, 78, 216, 0.06)"
                      : i % 2 === 0
                        ? "transparent"
                        : "rgba(0,0,0,0.01)",
                    borderBottom:
                      i < filtered.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    transition: "background 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = isVip
                        ? "rgba(96, 165, 250, 0.10)"
                        : "rgba(29, 78, 216, 0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = isVip
                        ? "transparent"
                        : i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)";
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(clinic)}
                    style={{ display: "none" }}
                  />
                  {/* Custom checkbox */}
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: isSelected
                        ? "2px solid #1d4ed8"
                        : "2px solid var(--border)",
                      background: isSelected ? "#1d4ed8" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                  >
                    {isSelected && (
                      <span
                        style={{
                          color: "white",
                          fontSize: 11,
                          fontWeight: 800,
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: 13,
                      color: isSelected ? "var(--text-0)" : "var(--text-1)",
                      fontWeight: isSelected ? 500 : 400,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {clinic}
                  </span>

                  {isSelected && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.6px",
                        color: isVip ? "#93c5fd" : "#1e40af",
                        background: "rgba(29, 78, 216, 0.12)",
                        border: "1px solid rgba(29, 78, 216, 0.25)",
                        borderRadius: 20,
                        padding: "1px 7px",
                        flexShrink: 0,
                        textTransform: "uppercase",
                      }}
                    >
                      VIP
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "18px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                background:
                  selected.size > 0
                    ? "rgba(29, 78, 216, 0.10)"
                    : "var(--bg-3)",
                color: selected.size > 0
                  ? (isVip ? "#93c5fd" : "#1e3a8a")
                  : "var(--text-3)",
                border:
                  selected.size > 0
                    ? "1px solid rgba(29, 78, 216, 0.30)"
                    : "1px solid var(--border)",
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 12,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              {selected.size > 0 ? `★ ${selected.size}` : "0"} selecionada
              {selected.size !== 1 ? "s" : ""}
            </span>
            {clinics.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                de {clinics.length}
              </span>
            )}
          </div>
          <div className="btn-group">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Salvar parceiras
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
