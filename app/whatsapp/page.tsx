"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getSavedFilters,
  getSavedPathologists,
  getDistinctPatologists,
  savePathologist,
  saveFilterToFile,
  getPatologistaSummary,
  getPatologistaRows,
  SavedFilter,
  Pathologist,
  Clinic,
  getDistinctClinics,
  getSavedClinics,
  saveClinic,
  getClinicaSummary,
  getClinicaRows,
} from "@/lib/clientDb";

interface SendResult {
  nome: string;
  telefone: string;
  success: boolean;
  message?: string;
  error?: string;
}

interface Preview {
  nome: string;
  telefone: string;
  total: number;
  message: string;
}

const DEFAULT_TEMPLATE =
  "Olá Dr(a) {nome}.\n\nSegue abaixo os casos do dia e de amanhã. Caso tenha necessidade de novas lâminas/reclivagem/cortes, por favor, avise-me. Ótimo dia!\n\nExame(s) pendente(s) em {data_hoje}.\n\n{linhas}\n\nQualquer dúvida, entre em contato conosco.";

const VARIABLES = [
  { key: "{nome}", desc: "Nome do patologista" },
  { key: "{total}", desc: "Total de registros no filtro" },
  { key: "{data_hoje}", desc: "Data atual (DD/MM/YYYY)" },
  { key: "{resumo}", desc: "Lista de eventos e contagens" },
  {
    key: "{linhas}",
    desc: "Lista detalhada das linhas com colunas selecionadas",
  },
];

function formatNome(nome: string): string {
  return nome
    .split(".")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function buildResumoPreview(
  eventos: { nome_evento: string; count: number }[],
): string {
  if (!eventos.length) return "📋 Nenhum evento encontrado.";
  const lines = ["📋 Resumo dos seus exames:"];
  for (const ev of eventos) {
    lines.push(`• ${ev.nome_evento}: ${ev.count}`);
  }
  return lines.join("\n");
}

function formatDateValue(val: string): string {
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return val;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function buildLinhasPreview(
  columns: { name: string; label: string; type: string }[],
  rows: Record<string, string>[],
): string {
  if (!rows.length) return "📋 Nenhum registro encontrado.";
  return rows
    .map((row) => {
      const parts = columns.map((col) => {
        const val = row[col.name] || "-";
        return col.type === "date" && val !== "-" ? formatDateValue(val) : val;
      });
      return `• ${parts.join(", ")}`;
    })
    .join("\n");
}

function formatDateBR(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export default function WhatsAppPage() {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<SavedFilter | null>(
    null,
  );
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [pathologists, setPathologists] = useState<Pathologist[]>([]);
  const [selectedPatIds, setSelectedPatIds] = useState<Set<string>>(new Set());
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({});
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [loadingPats, setLoadingPats] = useState(false);
  const [linhasColumns, setLinhasColumns] = useState<string[]>([]);
  type ActiveTab = 'patologistas' | 'clinicas';
  const [activeTab, setActiveTab] = useState<ActiveTab>('patologistas');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicIds, setSelectedClinicIds] = useState<Set<string>>(new Set());
  const [clinicPhoneEdits, setClinicPhoneEdits] = useState<Record<string, string>>({});
  const [savingClinicPhone, setSavingClinicPhone] = useState<string | null>(null);
  const [loadingClinics, setLoadingClinics] = useState(false);

  // Load filters and pathologists on mount
  useEffect(() => {
    getSavedFilters()
      .then((f) => setFilters(f))
      .catch(() => {});

    setLoadingPats(true);
    Promise.all([getDistinctPatologists(), getSavedPathologists()])
      .then(([distinctNames, savedPats]) => {
        const savedMap: Record<string, string> = {};
        for (const p of savedPats) savedMap[p.nome] = p.telefone;

        const merged: Pathologist[] = distinctNames.map((nome) => ({
          nome,
          telefone: savedMap[nome] ?? "",
        }));

        for (const p of savedPats) {
          if (!distinctNames.includes(p.nome)) {
            merged.push(p);
          }
        }

        setPathologists(merged);
        const phones: Record<string, string> = {};
        for (const p of merged) phones[p.nome] = p.telefone;
        setPhoneEdits(phones);
      })
      .catch(() => {})
      .finally(() => setLoadingPats(false));

    setLoadingClinics(true);
    Promise.all([getDistinctClinics(), getSavedClinics()])
      .then(([distinctNames, savedClinics]) => {
        const savedMap: Record<string, string> = {};
        for (const c of savedClinics) savedMap[c.nome] = c.telefone;
        const merged: Clinic[] = distinctNames.map((nome) => ({
          nome,
          telefone: savedMap[nome] ?? "",
        }));
        for (const c of savedClinics) {
          if (!distinctNames.includes(c.nome)) merged.push(c);
        }
        setClinics(merged);
        const phones: Record<string, string> = {};
        for (const c of merged) phones[c.nome] = c.telefone;
        setClinicPhoneEdits(phones);
      })
      .catch(() => {})
      .finally(() => setLoadingClinics(false));
  }, []);

  useEffect(() => {
    setLinhasColumns(
      selectedFilter?.whatsappLinhasColumns ?? selectedFilter?.selectedColumns ?? []
    );
  }, [selectedFilter?.id]);

  const saveLinhasColumns = useCallback(
    async (cols: string[]) => {
      if (!selectedFilter) return;
      const updated: SavedFilter = { ...selectedFilter, whatsappLinhasColumns: cols };
      await saveFilterToFile(updated);
      setFilters((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSelectedFilter(updated);
    },
    [selectedFilter],
  );

  const insertVariable = (v: string) => {
    setTemplate((prev) => prev + v);
  };

  const togglePatSelect = (nome: string) => {
    setSelectedPatIds((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  };

  const selectAllWithPhone = () => {
    const ids = pathologists
      .filter((p) => (phoneEdits[p.nome] || p.telefone).trim())
      .map((p) => p.nome);
    setSelectedPatIds(new Set(ids));
  };

  const deselectAll = () => setSelectedPatIds(new Set());

  const savePhone = useCallback(
    async (nome: string) => {
      setSavingPhone(nome);
      const tel =
        phoneEdits[nome] ??
        pathologists.find((p) => p.nome === nome)?.telefone ??
        "";
      const updated = pathologists.map((p) =>
        p.nome === nome ? { ...p, telefone: tel } : p,
      );
      try {
        await savePathologist(nome, tel);
        setPathologists(updated);
      } catch {}
      setSavingPhone(null);
    },
    [pathologists, phoneEdits],
  );

  const saveClinicPhone = useCallback(
    async (nome: string) => {
      setSavingClinicPhone(nome);
      const tel =
        clinicPhoneEdits[nome] ??
        clinics.find((c) => c.nome === nome)?.telefone ??
        "";
      try {
        await saveClinic(nome, tel);
        setClinics((prev) =>
          prev.map((c) => (c.nome === nome ? { ...c, telefone: tel } : c)),
        );
      } catch {}
      setSavingClinicPhone(null);
    },
    [clinics, clinicPhoneEdits],
  );

  const toggleClinicSelect = (nome: string) => {
    setSelectedClinicIds((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  };

  const selectAllClinicsWithPhone = () => {
    const ids = clinics
      .filter((c) => (clinicPhoneEdits[c.nome] || c.telefone).trim())
      .map((c) => c.nome);
    setSelectedClinicIds(new Set(ids));
  };

  const deselectAllClinics = () => setSelectedClinicIds(new Set());

  const handlePreview = async () => {
    if (!selectedFilter || !template.trim()) return;
    setLoadingPreview(true);
    setPreviews([]);
    const dataHoje = formatDateBR(new Date());

    const isClinicTab = activeTab === 'clinicas';
    const lista = isClinicTab
      ? clinics
          .filter((c) => selectedClinicIds.has(c.nome))
          .map((c) => ({ nome: c.nome, telefone: clinicPhoneEdits[c.nome] ?? c.telefone }))
      : pathologists
          .filter((p) => selectedPatIds.has(p.nome))
          .map((p) => ({ nome: p.nome, telefone: phoneEdits[p.nome] ?? p.telefone }));
    const getSummary = isClinicTab ? getClinicaSummary : getPatologistaSummary;
    const getRows = isClinicTab ? getClinicaRows : getPatologistaRows;

    const newPreviews: Preview[] = [];
    for (const item of lista) {
      try {
        const cols = linhasColumns.length
          ? linhasColumns
          : selectedFilter.selectedColumns;
        const summary = await getSummary(selectedFilter.conditions, item.nome);
        const rowData = await getRows(selectedFilter.conditions, cols, item.nome);

        const resumo = buildResumoPreview(summary.eventos ?? []);
        const linhas = buildLinhasPreview(
          rowData.columns ?? [],
          rowData.rows ?? [],
        );
        const msg = template
          .replace(/\{nome\}/g, formatNome(item.nome))
          .replace(/\{total\}/g, String(summary.total ?? 0))
          .replace(/\{data_hoje\}/g, dataHoje)
          .replace(/\{resumo\}/g, resumo)
          .replace(/\{linhas\}/g, linhas);
        newPreviews.push({
          nome: item.nome,
          telefone: item.telefone,
          total: summary.total ?? 0,
          message: msg,
        });
      } catch {
        newPreviews.push({
          nome: item.nome,
          telefone: item.telefone,
          total: 0,
          message: "(Erro ao carregar dados)",
        });
      }
    }
    setPreviews(newPreviews);
    setLoadingPreview(false);
  };

  const handleSend = async () => {
    const isClinicTab = activeTab === 'clinicas';
    const activeSelectedIds = isClinicTab ? selectedClinicIds : selectedPatIds;
    if (!selectedFilter || !template.trim() || activeSelectedIds.size === 0)
      return;
    setSending(true);
    setSendProgress(0);
    setSendResults([]);

    const itemsToSend = isClinicTab
      ? clinics
          .filter((c) => selectedClinicIds.has(c.nome))
          .map((c) => ({ nome: c.nome, telefone: clinicPhoneEdits[c.nome] ?? c.telefone }))
      : pathologists
          .filter((p) => selectedPatIds.has(p.nome))
          .map((p) => ({ nome: p.nome, telefone: phoneEdits[p.nome] ?? p.telefone }));
    const getSummary = isClinicTab ? getClinicaSummary : getPatologistaSummary;
    const getRows = isClinicTab ? getClinicaRows : getPatologistaRows;

    // Create payloads with completed messages, so proxy just relays to WAHA
    const dataHoje = formatDateBR(new Date());
    const messagesToSend = [];
    for (const item of itemsToSend) {
      const cols = linhasColumns.length
        ? linhasColumns
        : selectedFilter.selectedColumns;
      const summary = await getSummary(selectedFilter.conditions, item.nome);
      const rowData = await getRows(selectedFilter.conditions, cols, item.nome);

      const resumo = buildResumoPreview(summary.eventos ?? []);
      const linhas = buildLinhasPreview(
        rowData.columns ?? [],
        rowData.rows ?? [],
      );
      const finalMessage = template
        .replace(/\{nome\}/g, formatNome(item.nome))
        .replace(/\{total\}/g, String(summary.total ?? 0))
        .replace(/\{data_hoje\}/g, dataHoje)
        .replace(/\{resumo\}/g, resumo)
        .replace(/\{linhas\}/g, linhas);

      messagesToSend.push({
        nome: item.nome,
        telefone: item.telefone,
        message: finalMessage,
      });
    }

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend }),
      });
      const data = await res.json();
      setSendResults(data.results ?? []);
      setSendProgress(100);
    } catch (err: any) {
      setSendResults([
        { nome: "Erro", telefone: "", success: false, error: err.message },
      ]);
    }
    setSending(false);
  };

  const activeList = activeTab === 'clinicas' ? clinics : pathologists;
  const activeSelectedIds = activeTab === 'clinicas' ? selectedClinicIds : selectedPatIds;
  const activePhoneEdits = activeTab === 'clinicas' ? clinicPhoneEdits : phoneEdits;

  const withPhone = activeList.filter((p) =>
    (activePhoneEdits[p.nome] || p.telefone).trim(),
  ).length;
  const withoutPhone = activeList.length - withPhone;
  const selectedCount = activeSelectedIds.size;
  const canSend =
    !!selectedFilter &&
    template.trim().length > 0 &&
    selectedCount > 0 &&
    activeList.some(
      (p) =>
        activeSelectedIds.has(p.nome) && (activePhoneEdits[p.nome] || p.telefone).trim(),
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-0)",
        color: "var(--text-0)",
        fontFamily: "inherit",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--bg-1)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            color: "var(--text-3)",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Voltar
        </Link>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          📱 WhatsApp Automação
        </span>
        <span style={{ color: "var(--text-3)", fontSize: 12 }}>
          Envie mensagens personalizadas para patologistas
        </span>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 20,
          }}
        >
          {/* ===== SEÇÃO 1: Filtro ===== */}
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>
              1. Selecionar Filtro
            </div>

            {filters.length === 0 ? (
              <div
                style={{
                  color: "var(--text-3)",
                  fontSize: 12,
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                Nenhum filtro salvo. Crie um na página principal.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filters.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFilter(f)}
                    style={{
                      padding: "10px 12px",
                      border: `1px solid ${selectedFilter?.id === f.id ? "var(--blue)" : "var(--border)"}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      background:
                        selectedFilter?.id === f.id
                          ? "rgba(99,102,241,0.1)"
                          : "var(--bg-2)",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {f.name}
                    </div>
                    <div
                      style={{
                        color: "var(--text-3)",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {f.conditions.length} filtro(s) •{" "}
                      {f.selectedColumns.length} col(s)
                      {f.description && ` • ${f.description}`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedFilter && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "var(--bg-2)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "var(--text-0)",
                  }}
                >
                  Condições do filtro:
                </div>
                {selectedFilter.conditions.map((c: any, i: number) => (
                  <div
                    key={i}
                    style={{ color: "var(--text-2)", marginBottom: 2 }}
                  >
                    • <span style={{ color: "var(--blue)" }}>{c.column}</span>{" "}
                    {c.operator}{" "}
                    <span style={{ color: "var(--green)" }}>{c.value}</span>
                    {c.value2 && ` — ${c.value2}`}
                  </div>
                ))}
              </div>
            )}

            {selectedFilter && selectedFilter.selectedColumns.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "var(--bg-2)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "var(--text-0)",
                  }}
                >
                  Colunas para {"{linhas}"}:
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  {selectedFilter.selectedColumns.map((col) => (
                    <label
                      key={col}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={linhasColumns.includes(col)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...linhasColumns, col]
                            : linhasColumns.filter((c) => c !== col);
                          setLinhasColumns(next);
                          saveLinhasColumns(next);
                        }}
                        style={{
                          accentColor: "var(--blue)",
                          cursor: "pointer",
                        }}
                      />
                      <span
                        style={{
                          color: "var(--text-1)",
                          fontFamily: "monospace",
                        }}
                      >
                        {col}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===== SEÇÃO 2: Mensagem ===== */}
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>
              2. Mensagem
            </div>

            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  marginBottom: 6,
                }}
              >
                Variáveis disponíveis (clique para inserir):
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    title={v.desc}
                    style={{
                      padding: "3px 8px",
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid var(--blue)",
                      borderRadius: 4,
                      color: "var(--blue)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={12}
              style={{
                width: "100%",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-0)",
                padding: 10,
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              placeholder="Digite sua mensagem aqui..."
            />

            <button
              onClick={handlePreview}
              disabled={
                !selectedFilter ||
                !template.trim() ||
                selectedCount === 0 ||
                loadingPreview
              }
              style={{
                marginTop: 12,
                width: "100%",
                padding: "9px 16px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-0)",
                cursor:
                  !selectedFilter || !template.trim() || selectedCount === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !selectedFilter || !template.trim() || selectedCount === 0
                    ? 0.5
                    : 1,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {loadingPreview ? "⏳ Carregando..." : "👁 Pré-visualizar"}
            </button>

            {previews.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "var(--text-2)",
                  }}
                >
                  Preview ({previews.length} mensagem(ns)):
                </div>
                <div
                  style={{
                    maxHeight: 500,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {previews.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-3)",
                          marginBottom: 6,
                        }}
                      >
                        Para:{" "}
                        <strong style={{ color: "var(--text-0)" }}>
                          {p.nome}
                        </strong>{" "}
                        ({p.telefone}) — {p.total} registro(s)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                          color: "var(--text-1)",
                          fontFamily: "inherit",
                        }}
                      >
                        {p.message}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===== SEÇÃO 3: Patologistas / Clínicas ===== */}
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Tab header */}
            <div style={{ display: "flex", gap: 0, marginBottom: 12 }}>
              {(["patologistas", "clinicas"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 14px",
                    background: activeTab === tab ? "var(--blue)" : "var(--bg-2)",
                    border: "1px solid var(--border)",
                    borderRadius: tab === "patologistas" ? "4px 0 0 4px" : "0 4px 4px 0",
                    color: activeTab === tab ? "#fff" : "var(--text-2)",
                    fontSize: 12,
                    fontWeight: activeTab === tab ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {tab === "patologistas" ? "3. Patologistas" : "Clínicas"}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              <span>
                {selectedCount} selecionado(s) •{" "}
                <span style={{ color: "var(--green)" }}>
                  {withPhone} com telefone
                </span>
                {withoutPhone > 0 && (
                  <span style={{ color: "var(--red)" }}>
                    {" "}
                    • {withoutPhone} sem telefone
                  </span>
                )}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={activeTab === "clinicas" ? selectAllClinicsWithPhone : selectAllWithPhone}
                style={{
                  padding: "5px 10px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--text-1)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Selecionar todos com telefone
              </button>
              <button
                onClick={activeTab === "clinicas" ? deselectAllClinics : deselectAll}
                style={{
                  padding: "5px 10px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--text-3)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Desmarcar todos
              </button>
            </div>

            {/* Patologistas list */}
            {activeTab === "patologistas" && (
              loadingPats ? (
                <div
                  style={{
                    color: "var(--text-3)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  Carregando patologistas...
                </div>
              ) : pathologists.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-3)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  Nenhum patologista encontrado no banco de dados.
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: 500,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {pathologists.map((pat) => {
                    const tel = phoneEdits[pat.nome] ?? pat.telefone;
                    const hasPhone = tel.trim().length > 0;
                    const isSelected = selectedPatIds.has(pat.nome);
                    return (
                      <div
                        key={pat.nome}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          background: isSelected
                            ? "rgba(99,102,241,0.08)"
                            : "var(--bg-2)",
                          border: `1px solid ${isSelected ? "var(--blue)" : "var(--border)"}`,
                          borderRadius: 6,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePatSelect(pat.nome)}
                          style={{
                            cursor: "pointer",
                            accentColor: "var(--blue)",
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: hasPhone ? "var(--green)" : "var(--red)",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "var(--text-0)",
                            }}
                          >
                            {pat.nome}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 3,
                            }}
                          >
                            <input
                              type="text"
                              placeholder="5511999999999"
                              value={phoneEdits[pat.nome] ?? pat.telefone}
                              onChange={(e) =>
                                setPhoneEdits((prev) => ({
                                  ...prev,
                                  [pat.nome]: e.target.value,
                                }))
                              }
                              onBlur={() => savePhone(pat.nome)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && savePhone(pat.nome)
                              }
                              style={{
                                flex: 1,
                                background: "var(--bg-0)",
                                border: "1px solid var(--border)",
                                borderRadius: 4,
                                color: "var(--text-1)",
                                padding: "2px 6px",
                                fontSize: 11,
                                fontFamily: "monospace",
                              }}
                            />
                            {savingPhone === pat.nome && (
                              <span
                                style={{ fontSize: 10, color: "var(--text-3)" }}
                              >
                                💾
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Clínicas list */}
            {activeTab === "clinicas" && (
              loadingClinics ? (
                <div
                  style={{
                    color: "var(--text-3)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  Carregando clínicas...
                </div>
              ) : clinics.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-3)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  Nenhuma clínica encontrada no banco de dados.
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: 500,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {clinics.map((clinic) => {
                    const tel = clinicPhoneEdits[clinic.nome] ?? clinic.telefone;
                    const hasPhone = tel.trim().length > 0;
                    const isSelected = selectedClinicIds.has(clinic.nome);
                    return (
                      <div
                        key={clinic.nome}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          background: isSelected
                            ? "rgba(99,102,241,0.08)"
                            : "var(--bg-2)",
                          border: `1px solid ${isSelected ? "var(--blue)" : "var(--border)"}`,
                          borderRadius: 6,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleClinicSelect(clinic.nome)}
                          style={{
                            cursor: "pointer",
                            accentColor: "var(--blue)",
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: hasPhone ? "var(--green)" : "var(--red)",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "var(--text-0)",
                            }}
                          >
                            {clinic.nome}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 3,
                            }}
                          >
                            <input
                              type="text"
                              placeholder="5511999999999"
                              value={clinicPhoneEdits[clinic.nome] ?? clinic.telefone}
                              onChange={(e) =>
                                setClinicPhoneEdits((prev) => ({
                                  ...prev,
                                  [clinic.nome]: e.target.value,
                                }))
                              }
                              onBlur={() => saveClinicPhone(clinic.nome)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && saveClinicPhone(clinic.nome)
                              }
                              style={{
                                flex: 1,
                                background: "var(--bg-0)",
                                border: "1px solid var(--border)",
                                borderRadius: 4,
                                color: "var(--text-1)",
                                padding: "2px 6px",
                                fontSize: 11,
                                fontFamily: "monospace",
                              }}
                            />
                            {savingClinicPhone === clinic.nome && (
                              <span
                                style={{ fontSize: 10, color: "var(--text-3)" }}
                              >
                                💾
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* ===== RODAPÉ: Enviar ===== */}
        <div
          style={{
            marginTop: 24,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{
                padding: "10px 28px",
                background: canSend && !sending ? "var(--blue)" : "var(--bg-2)",
                border: "none",
                borderRadius: 6,
                color: canSend && !sending ? "#fff" : "var(--text-3)",
                fontWeight: 600,
                fontSize: 14,
                cursor: canSend && !sending ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              {sending ? "⏳ Enviando..." : "📤 Enviar Mensagens"}
            </button>

            {!selectedFilter && (
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                ← Selecione um filtro
              </span>
            )}
            {selectedFilter && !template.trim() && (
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                ← Escreva a mensagem
              </span>
            )}
            {selectedFilter && template.trim() && selectedCount === 0 && (
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                ← Selecione {activeTab === "clinicas" ? "clínicas" : "patologistas"}
              </span>
            )}
            {selectedFilter && template.trim() && selectedCount > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                Pronto para enviar para{" "}
                <strong>
                  {activeList.filter(
                    (p) =>
                      activeSelectedIds.has(p.nome) &&
                      (activePhoneEdits[p.nome] || p.telefone).trim(),
                  ).length}
                </strong>{" "}
                {activeTab === "clinicas" ? "clínica(s)" : "patologista(s)"}
              </span>
            )}
          </div>

          {sending && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 6,
                  background: "var(--bg-2)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: "var(--blue)",
                    width: `${sendProgress}%`,
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>
          )}

          {sendResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 10,
                  color: "var(--text-0)",
                }}
              >
                Resultados do envio:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sendResults.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: r.success
                        ? "rgba(34,197,94,0.08)"
                        : "rgba(239,68,68,0.08)",
                      border: `1px solid ${r.success ? "var(--green)" : "var(--red)"}`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {r.success ? "✓" : "✗"}
                    </span>
                    <span style={{ fontWeight: 600 }}>{r.nome}</span>
                    <span
                      style={{
                        color: "var(--text-3)",
                        fontFamily: "monospace",
                      }}
                    >
                      {r.telefone}
                    </span>
                    {r.error && (
                      <span style={{ color: "var(--red)", marginLeft: "auto" }}>
                        {r.error}
                      </span>
                    )}
                    {r.success && (
                      <span
                        style={{ color: "var(--green)", marginLeft: "auto" }}
                      >
                        Enviado
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
