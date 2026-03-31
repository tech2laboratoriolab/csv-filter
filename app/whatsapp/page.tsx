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
  FilterCondition,
  Pathologist,
  Clinic,
  getDistinctClinics,
  getSavedClinics,
  saveClinic,
  getClinicaSummary,
  getClinicaRows,
  getSavedBioMolecularPhone,
  saveBioMolecularPhone,
  getBioMolecularSummary,
  getBioMolecularRows,
  getSavedAnalisesClinicasPhone,
  saveAnalisesClinicasPhone,
  COLUMNS,
} from "@/lib/clientDb";

interface SendResult {
  nome: string;
  telefone: string;
  success: boolean;
  message?: string;
  error?: string;
}

interface Preview {
  id: string;
  nome: string;
  telefone: string;
  total: number;
  message: string;
}

const DEFAULT_PAT_TEMPLATE =
  "Olá Dr(a) {nome}.\n\nSegue abaixo os casos do dia e de amanhã. Caso tenha necessidade de novas lâminas/reclivagem/cortes, por favor, avise-me. Ótimo dia!\n\nExame(s) pendente(s) em {data_hoje}.\n\n{linhas}\n\nQualquer dúvida, entre em contato conosco.";

const DEFAULT_CLINIC_TEMPLATE =
  "Prezado Parceiro {nome}.\n\nViemos informar que os Laudos do(a)s Pacientes estão disponíveis abaixo:\n\nLaudos disponíveis em {data_hoje}.\n\n{linhas}\n\nQualquer dúvida, entre em contato conosco.";

const DEFAULT_BIOMOL_TEMPLATE =
  "Prezado Parceiro.\n\nSegue abaixo os casos de Biologia Molecular do dia. Ótimo dia!\n\nRegistros em {data_hoje}.\n\n{linhas}\n\nQualquer dúvida, entre em contato conosco.";

const VARIABLES_PAT = [
  { key: "{nome}", desc: "Nome do patologista" },
  { key: "{total}", desc: "Total de registros no filtro" },
  { key: "{data_hoje}", desc: "Data atual (DD/MM/YYYY)" },
  { key: "{resumo}", desc: "Lista de eventos e contagens" },
  {
    key: "{linhas}",
    desc: "Lista detalhada das linhas com colunas selecionadas",
  },
];

const VARIABLES_CLINIC = [
  { key: "{nome}", desc: "Nome da clínica" },
  { key: "{total}", desc: "Total de registros no filtro" },
  { key: "{data_hoje}", desc: "Data atual (DD/MM/YYYY)" },
  { key: "{resumo}", desc: "Lista de eventos e contagens" },
  {
    key: "{linhas}",
    desc: "Lista detalhada das linhas com colunas selecionadas",
  },
];

const VARIABLES_BIOMOL = [
  { key: "{total}", desc: "Total de registros no filtro" },
  { key: "{data_hoje}", desc: "Data atual (DD/MM/YYYY)" },
  { key: "{resumo}", desc: "Lista de eventos e contagens" },
  {
    key: "{linhas}",
    desc: "Lista detalhada das linhas com colunas selecionadas",
  },
];

const DEFAULT_ANALISES_TEMPLATE =
  "Prezado Parceiro.\n\nSegue abaixo os casos de Análises Clínicas do dia. Ótimo dia!\n\nRegistros em {data_hoje}.\n\n{linhas}\n\nQualquer dúvida, entre em contato conosco.";

const VARIABLES_ANALISES = [
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

function getRowEventos(
  row: Record<string, string>,
): { nome_evento: string; count: number }[] {
  const nomeEvento = row["nom_evento"] || row["cod_evento"] || "";
  if (!nomeEvento) return [];
  return [{ nome_evento: nomeEvento, count: 1 }];
}

function formatDateBR(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

const DATE_COLUMN_NAMES = new Set(
  COLUMNS.filter((c) => c.type === "date").map((c) => c.name),
);

const DATE_OPERATORS: FilterCondition["operator"][] = [
  "date_after",
  "date_before",
  "date_between",
  "is_today",
  "is_future",
  "is_past",
  "is_today_or_tomorrow",
  "is_future_or_today",
  "is_past_or_today",
];

function applyWhatsAppDateFilter(filter: SavedFilter): FilterCondition[] {
  const hasPrevistaCond = filter.conditions.some(
    (c) => c.column === "dta_prevista" && DATE_OPERATORS.includes(c.operator),
  );

  if (hasPrevistaCond) {
    // Replace only the dta_prevista date-range condition; leave everything else intact
    return filter.conditions.map((c) =>
      c.column === "dta_prevista" && DATE_OPERATORS.includes(c.operator)
        ? {
            column: "dta_prevista",
            operator: "is_today_or_tomorrow" as const,
            value: "",
          }
        : c,
    );
  }

  // Só injeta se dta_prevista estiver nas colunas selecionadas
  if (!filter.selectedColumns.includes("dta_prevista")) {
    return filter.conditions;
  }

  return [
    ...filter.conditions,
    {
      column: "dta_prevista",
      operator: "is_today_or_tomorrow" as const,
      value: "",
    },
  ];
}

function sortRowsDescByDate(
  rows: Record<string, string>[],
  columns: { name: string; type: string }[],
): Record<string, string>[] {
  const dateCol = columns.find((c) => c.type === "date");
  if (!dateCol) return rows;
  return [...rows].sort((a, b) => {
    const va = a[dateCol.name] ?? "";
    const vb = b[dateCol.name] ?? "";
    return vb.localeCompare(va);
  });
}

async function combineFilterData(
  selectedFilters: SavedFilter[],
  linhasColumns: string[],
  getSummary: (conditions: any, name: string) => Promise<any>,
  getRows: (conditions: any, cols: string[], name: string) => Promise<any>,
  entityName: string,
) {
  const results = await Promise.all(
    selectedFilters.map(async (f) => {
      const cols = linhasColumns.length ? linhasColumns : f.selectedColumns;
      const conditions = applyWhatsAppDateFilter(f);
      return {
        summary: await getSummary(conditions, entityName),
        rowData: await getRows(conditions, cols, entityName),
      };
    }),
  );

  const totalCombined = results.reduce(
    (acc, r) => acc + (r.summary.total ?? 0),
    0,
  );

  const eventoMap = new Map<string, number>();
  for (const { summary } of results) {
    for (const ev of summary.eventos ?? []) {
      eventoMap.set(
        ev.nome_evento,
        (eventoMap.get(ev.nome_evento) ?? 0) + ev.count,
      );
    }
  }
  const eventosCombined = Array.from(eventoMap.entries())
    .map(([nome_evento, count]) => ({ nome_evento, count }))
    .sort((a, b) => b.count - a.count);

  const columnsCombined =
    results.find((r) => r.rowData.columns?.length)?.rowData.columns ?? [];
  const rowsCombined = sortRowsDescByDate(
    results.flatMap((r) => r.rowData.rows ?? []),
    columnsCombined,
  );

  return { totalCombined, eventosCombined, columnsCombined, rowsCombined };
}

export default function WhatsAppPage() {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [selectedFilterIds, setSelectedFilterIds] = useState<Set<string>>(
    new Set(),
  );
  const [templatePat, setTemplatePat] = useState(DEFAULT_PAT_TEMPLATE);
  const [templateClinic, setTemplateClinic] = useState(DEFAULT_CLINIC_TEMPLATE);
  const [templateBioMol, setTemplateBioMol] = useState(DEFAULT_BIOMOL_TEMPLATE);
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
  type ActiveTab =
    | "patologistas"
    | "clinicas"
    | "bio-molecular"
    | "analises-clinicas";
  const [activeTab, setActiveTab] = useState<ActiveTab>("patologistas");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicIds, setSelectedClinicIds] = useState<Set<string>>(
    new Set(),
  );
  const [clinicPhoneEdits, setClinicPhoneEdits] = useState<
    Record<string, string>
  >({});
  const [savingClinicPhone, setSavingClinicPhone] = useState<string | null>(
    null,
  );
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [bioMolPhoneEdit, setBioMolPhoneEdit] = useState("");
  const [savingBioMolPhone, setSavingBioMolPhone] = useState(false);
  const [bioMolSelected, setBioMolSelected] = useState(false);
  const [templateAnalises, setTemplateAnalises] = useState(
    DEFAULT_ANALISES_TEMPLATE,
  );
  const [analisePhoneEdit, setAnalisePhoneEdit] = useState("");
  const [savingAnalisePhone, setSavingAnalisePhone] = useState(false);
  const [analiseSelected, setAnaliseSelected] = useState(false);
  const [modoEnvioIndividual, setModoEnvioIndividual] = useState(false);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(
    new Set(),
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewSearchQuery, setPreviewSearchQuery] = useState("");

  const selectedFilters = filters.filter((f) => selectedFilterIds.has(f.id));

  const toggleFilterSelect = (filterId: string) => {
    setSelectedFilterIds((prev) => {
      const next = new Set(prev);
      next.has(filterId) ? next.delete(filterId) : next.add(filterId);
      return next;
    });
  };

  const isClinicActive = activeTab === "clinicas";
  const isBioMolActive = activeTab === "bio-molecular";
  const isAnalisesActive = activeTab === "analises-clinicas";
  const template = isAnalisesActive
    ? templateAnalises
    : isBioMolActive
      ? templateBioMol
      : isClinicActive
        ? templateClinic
        : templatePat;
  const setTemplate = isAnalisesActive
    ? setTemplateAnalises
    : isBioMolActive
      ? setTemplateBioMol
      : isClinicActive
        ? setTemplateClinic
        : setTemplatePat;
  const VARIABLES = isAnalisesActive
    ? VARIABLES_ANALISES
    : isBioMolActive
      ? VARIABLES_BIOMOL
      : isClinicActive
        ? VARIABLES_CLINIC
        : VARIABLES_PAT;

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

    getSavedBioMolecularPhone()
      .then((tel) => setBioMolPhoneEdit(tel))
      .catch(() => {});

    getSavedAnalisesClinicasPhone()
      .then((tel) => setAnalisePhoneEdit(tel))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const seen = new Set<string>();
    const union: string[] = [];
    for (const f of selectedFilters) {
      for (const col of f.whatsappLinhasColumns ?? f.selectedColumns ?? []) {
        if (!seen.has(col)) {
          seen.add(col);
          union.push(col);
        }
      }
    }
    setLinhasColumns(union);
  }, [selectedFilterIds]);

  const saveLinhasColumns = useCallback(
    async (cols: string[]) => {
      if (!selectedFilters.length) return;
      await Promise.all(
        selectedFilters.map(async (f) => {
          const updated = { ...f, whatsappLinhasColumns: cols };
          await saveFilterToFile(updated);
          setFilters((prev) =>
            prev.map((pf) => (pf.id === updated.id ? updated : pf)),
          );
        }),
      );
    },
    [selectedFilters],
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

  const saveBioMolPhone = useCallback(async () => {
    setSavingBioMolPhone(true);
    try {
      await saveBioMolecularPhone(bioMolPhoneEdit);
    } catch {}
    setSavingBioMolPhone(false);
  }, [bioMolPhoneEdit]);

  const saveAnalisePhone = useCallback(async () => {
    setSavingAnalisePhone(true);
    try {
      await saveAnalisesClinicasPhone(analisePhoneEdit);
    } catch {}
    setSavingAnalisePhone(false);
  }, [analisePhoneEdit]);

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
    if (selectedFilters.length === 0 || !template.trim()) return;
    setLoadingPreview(true);
    setPreviews([]);
    const dataHoje = formatDateBR(new Date());

    const newPreviews: Preview[] = [];

    if (isBioMolActive) {
      if (!bioMolSelected) {
        setLoadingPreview(false);
        return;
      }
      try {
        const bioResults = await Promise.all(
          selectedFilters.map(async (f) => {
            const cols = linhasColumns.length
              ? linhasColumns
              : f.selectedColumns;
            const conditions = applyWhatsAppDateFilter(f);
            const summary = await getBioMolecularSummary(conditions);
            const rowData = await getBioMolecularRows(conditions, cols);
            return { summary, rowData };
          }),
        );

        const totalCombined = bioResults.reduce(
          (acc, r) => acc + (r.summary.total ?? 0),
          0,
        );
        const eventoMap = new Map<string, number>();
        for (const { summary } of bioResults) {
          for (const ev of summary.eventos ?? []) {
            eventoMap.set(
              ev.nome_evento,
              (eventoMap.get(ev.nome_evento) ?? 0) + ev.count,
            );
          }
        }
        const eventosCombined = Array.from(eventoMap.entries())
          .map(([nome_evento, count]) => ({ nome_evento, count }))
          .sort((a, b) => b.count - a.count);
        const columnsCombined =
          bioResults.find((r) => r.rowData.columns?.length)?.rowData.columns ??
          [];
        const rowsCombined = sortRowsDescByDate(
          bioResults.flatMap((r) => r.rowData.rows ?? []),
          columnsCombined,
        );

        const resumo = buildResumoPreview(eventosCombined);
        const linhas = buildLinhasPreview(columnsCombined, rowsCombined);
        const msg = template
          .replace(/\{total\}/g, String(totalCombined))
          .replace(/\{data_hoje\}/g, dataHoje)
          .replace(/\{resumo\}/g, resumo)
          .replace(/\{linhas\}/g, linhas);
        newPreviews.push({
          id: "bio-molecular",
          nome: "Biologia Molecular",
          telefone: bioMolPhoneEdit,
          total: totalCombined,
          message: msg,
        });
      } catch {
        newPreviews.push({
          id: "bio-molecular",
          nome: "Biologia Molecular",
          telefone: bioMolPhoneEdit,
          total: 0,
          message: "(Erro ao carregar dados)",
        });
      }
    } else if (isAnalisesActive) {
      if (!analiseSelected) {
        setLoadingPreview(false);
        return;
      }
      try {
        const analisesResults = await Promise.all(
          selectedFilters.map(async (f) => {
            const cols = linhasColumns.length
              ? linhasColumns
              : f.selectedColumns;
            const conditions = applyWhatsAppDateFilter(f);
            const summary = await getBioMolecularSummary(conditions);
            const rowData = await getBioMolecularRows(conditions, cols);
            return { summary, rowData };
          }),
        );

        const totalCombined = analisesResults.reduce(
          (acc, r) => acc + (r.summary.total ?? 0),
          0,
        );
        const eventoMap = new Map<string, number>();
        for (const { summary } of analisesResults) {
          for (const ev of summary.eventos ?? []) {
            eventoMap.set(
              ev.nome_evento,
              (eventoMap.get(ev.nome_evento) ?? 0) + ev.count,
            );
          }
        }
        const eventosCombined = Array.from(eventoMap.entries())
          .map(([nome_evento, count]) => ({ nome_evento, count }))
          .sort((a, b) => b.count - a.count);
        const columnsCombined =
          analisesResults.find((r) => r.rowData.columns?.length)?.rowData
            .columns ?? [];
        const rowsCombined = sortRowsDescByDate(
          analisesResults.flatMap((r) => r.rowData.rows ?? []),
          columnsCombined,
        );

        const resumo = buildResumoPreview(eventosCombined);
        const linhas = buildLinhasPreview(columnsCombined, rowsCombined);
        const msg = template
          .replace(/\{total\}/g, String(totalCombined))
          .replace(/\{data_hoje\}/g, dataHoje)
          .replace(/\{resumo\}/g, resumo)
          .replace(/\{linhas\}/g, linhas);
        newPreviews.push({
          id: "analises-clinicas",
          nome: "Análises Clínicas",
          telefone: analisePhoneEdit,
          total: totalCombined,
          message: msg,
        });
      } catch {
        newPreviews.push({
          id: "analises-clinicas",
          nome: "Análises Clínicas",
          telefone: analisePhoneEdit,
          total: 0,
          message: "(Erro ao carregar dados)",
        });
      }
    } else {
      const isClinicTab = isClinicActive;
      const lista = isClinicTab
        ? clinics
            .filter((c) => selectedClinicIds.has(c.nome))
            .map((c) => ({
              nome: c.nome,
              telefone: clinicPhoneEdits[c.nome] ?? c.telefone,
            }))
        : pathologists
            .filter((p) => selectedPatIds.has(p.nome))
            .map((p) => ({
              nome: p.nome,
              telefone: phoneEdits[p.nome] ?? p.telefone,
            }));
      const getSummary = isClinicTab
        ? getClinicaSummary
        : getPatologistaSummary;
      const getRows = isClinicTab ? getClinicaRows : getPatologistaRows;

      for (const item of lista) {
        try {
          const {
            totalCombined,
            eventosCombined,
            columnsCombined,
            rowsCombined,
          } = await combineFilterData(
            selectedFilters,
            linhasColumns,
            getSummary,
            getRows,
            item.nome,
          );

          if (modoEnvioIndividual && rowsCombined.length > 0) {
            for (let i = 0; i < rowsCombined.length; i++) {
              const row = rowsCombined[i];
              const rowEventos = getRowEventos(row);
              const resumo = buildResumoPreview(rowEventos);
              const linhas = buildLinhasPreview(columnsCombined, [row]);
              const msg = template
                .replace(/\{nome\}/g, formatNome(item.nome))
                .replace(/\{total\}/g, "1")
                .replace(/\{data_hoje\}/g, dataHoje)
                .replace(/\{resumo\}/g, resumo)
                .replace(/\{linhas\}/g, linhas);
              newPreviews.push({
                id: `${item.nome}-${i}`,
                nome: `${item.nome} (${i + 1}/${rowsCombined.length})`,
                telefone: item.telefone,
                total: 1,
                message: msg,
              });
            }
          } else {
            const resumo = buildResumoPreview(eventosCombined);
            const linhas = buildLinhasPreview(columnsCombined, rowsCombined);
            const msg = template
              .replace(/\{nome\}/g, formatNome(item.nome))
              .replace(/\{total\}/g, String(totalCombined))
              .replace(/\{data_hoje\}/g, dataHoje)
              .replace(/\{resumo\}/g, resumo)
              .replace(/\{linhas\}/g, linhas);
            newPreviews.push({
              id: item.nome,
              nome: item.nome,
              telefone: item.telefone,
              total: totalCombined,
              message: msg,
            });
          }
        } catch {
          newPreviews.push({
            id: `${item.nome}-error`,
            nome: item.nome,
            telefone: item.telefone,
            total: 0,
            message: "(Erro ao carregar dados)",
          });
        }
      }
    }

    setPreviews(newPreviews);
    setSelectedPreviewIds(new Set(newPreviews.map((p) => p.id)));
    setPreviewSearchQuery("");
    setLoadingPreview(false);
  };

  const handleSend = async () => {
    if (selectedFilters.length === 0 || !template.trim()) return;
    setSending(true);
    setSendProgress(0);
    setSendResults([]);

    const dataHoje = formatDateBR(new Date());
    const messagesToSend = [];

    if (isBioMolActive) {
      if (!bioMolSelected || !bioMolPhoneEdit.trim()) {
        setSending(false);
        return;
      }
      const bioResults = await Promise.all(
        selectedFilters.map(async (f) => {
          const cols = linhasColumns.length ? linhasColumns : f.selectedColumns;
          const conditions = applyWhatsAppDateFilter(f);
          const summary = await getBioMolecularSummary(conditions);
          const rowData = await getBioMolecularRows(conditions, cols);
          return { summary, rowData };
        }),
      );
      const totalCombined = bioResults.reduce(
        (acc, r) => acc + (r.summary.total ?? 0),
        0,
      );
      const eventoMap = new Map<string, number>();
      for (const { summary } of bioResults) {
        for (const ev of summary.eventos ?? []) {
          eventoMap.set(
            ev.nome_evento,
            (eventoMap.get(ev.nome_evento) ?? 0) + ev.count,
          );
        }
      }
      const eventosCombined = Array.from(eventoMap.entries())
        .map(([nome_evento, count]) => ({ nome_evento, count }))
        .sort((a, b) => b.count - a.count);
      const columnsCombined =
        bioResults.find((r) => r.rowData.columns?.length)?.rowData.columns ??
        [];
      const rowsCombined = sortRowsDescByDate(
        bioResults.flatMap((r) => r.rowData.rows ?? []),
        columnsCombined,
      );

      const resumo = buildResumoPreview(eventosCombined);
      const linhas = buildLinhasPreview(columnsCombined, rowsCombined);
      const finalMessage = template
        .replace(/\{total\}/g, String(totalCombined))
        .replace(/\{data_hoje\}/g, dataHoje)
        .replace(/\{resumo\}/g, resumo)
        .replace(/\{linhas\}/g, linhas);
      messagesToSend.push({
        nome: "Biologia Molecular",
        telefone: bioMolPhoneEdit,
        message: finalMessage,
      });
    } else if (isAnalisesActive) {
      if (!analiseSelected || !analisePhoneEdit.trim()) {
        setSending(false);
        return;
      }
      const analisesResults = await Promise.all(
        selectedFilters.map(async (f) => {
          const cols = linhasColumns.length ? linhasColumns : f.selectedColumns;
          const conditions = applyWhatsAppDateFilter(f);
          const summary = await getBioMolecularSummary(conditions);
          const rowData = await getBioMolecularRows(conditions, cols);
          return { summary, rowData };
        }),
      );
      const totalCombined = analisesResults.reduce(
        (acc, r) => acc + (r.summary.total ?? 0),
        0,
      );
      const eventoMap = new Map<string, number>();
      for (const { summary } of analisesResults) {
        for (const ev of summary.eventos ?? []) {
          eventoMap.set(
            ev.nome_evento,
            (eventoMap.get(ev.nome_evento) ?? 0) + ev.count,
          );
        }
      }
      const eventosCombined = Array.from(eventoMap.entries())
        .map(([nome_evento, count]) => ({ nome_evento, count }))
        .sort((a, b) => b.count - a.count);
      const columnsCombined =
        analisesResults.find((r) => r.rowData.columns?.length)?.rowData
          .columns ?? [];
      const rowsCombined = sortRowsDescByDate(
        analisesResults.flatMap((r) => r.rowData.rows ?? []),
        columnsCombined,
      );
      const resumo = buildResumoPreview(eventosCombined);
      const linhas = buildLinhasPreview(columnsCombined, rowsCombined);
      const finalMessage = template
        .replace(/\{total\}/g, String(totalCombined))
        .replace(/\{data_hoje\}/g, dataHoje)
        .replace(/\{resumo\}/g, resumo)
        .replace(/\{linhas\}/g, linhas);
      messagesToSend.push({
        nome: "Análises Clínicas",
        telefone: analisePhoneEdit,
        message: finalMessage,
      });
    } else {
      const isClinicTab = isClinicActive;
      const localActiveIds = isClinicTab ? selectedClinicIds : selectedPatIds;
      if (localActiveIds.size === 0) {
        setSending(false);
        return;
      }
      const itemsToSend = isClinicTab
        ? clinics
            .filter((c) => selectedClinicIds.has(c.nome))
            .map((c) => ({
              nome: c.nome,
              telefone: clinicPhoneEdits[c.nome] ?? c.telefone,
            }))
        : pathologists
            .filter((p) => selectedPatIds.has(p.nome))
            .map((p) => ({
              nome: p.nome,
              telefone: phoneEdits[p.nome] ?? p.telefone,
            }));
      const getSummary = isClinicTab
        ? getClinicaSummary
        : getPatologistaSummary;
      const getRows = isClinicTab ? getClinicaRows : getPatologistaRows;

      for (const item of itemsToSend) {
        const {
          totalCombined,
          eventosCombined,
          columnsCombined,
          rowsCombined,
        } = await combineFilterData(
          selectedFilters,
          linhasColumns,
          getSummary,
          getRows,
          item.nome,
        );

        if (!totalCombined) continue;

        if (modoEnvioIndividual && rowsCombined.length > 0) {
          for (let i = 0; i < rowsCombined.length; i++) {
            const msgId = `${item.nome}-${i}`;
            if (previews.length > 0 && !selectedPreviewIds.has(msgId)) continue;
            const row = rowsCombined[i];
            const rowEventos = getRowEventos(row);
            const resumo = buildResumoPreview(rowEventos);
            const linhas = buildLinhasPreview(columnsCombined, [row]);
            const finalMessage = template
              .replace(/\{nome\}/g, formatNome(item.nome))
              .replace(/\{total\}/g, "1")
              .replace(/\{data_hoje\}/g, dataHoje)
              .replace(/\{resumo\}/g, resumo)
              .replace(/\{linhas\}/g, linhas);
            messagesToSend.push({
              nome: `${item.nome} (linha ${i + 1})`,
              telefone: item.telefone,
              message: finalMessage,
            });
          }
        } else {
          const resumo = buildResumoPreview(eventosCombined);
          const linhas = buildLinhasPreview(columnsCombined, rowsCombined);
          const finalMessage = template
            .replace(/\{nome\}/g, formatNome(item.nome))
            .replace(/\{total\}/g, String(totalCombined))
            .replace(/\{data_hoje\}/g, dataHoje)
            .replace(/\{resumo\}/g, resumo)
            .replace(/\{linhas\}/g, linhas);
          messagesToSend.push({
            nome: item.nome,
            telefone: item.telefone,
            message: finalMessage,
          });
        }
      }
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

  const activeList =
    isBioMolActive || isAnalisesActive
      ? []
      : activeTab === "clinicas"
        ? clinics
        : pathologists;
  const activeSelectedIds =
    isBioMolActive || isAnalisesActive
      ? new Set<string>()
      : activeTab === "clinicas"
        ? selectedClinicIds
        : selectedPatIds;
  const activePhoneEdits =
    isBioMolActive || isAnalisesActive
      ? ({} as Record<string, string>)
      : activeTab === "clinicas"
        ? clinicPhoneEdits
        : phoneEdits;

  const withPhone = isAnalisesActive
    ? analisePhoneEdit.trim()
      ? 1
      : 0
    : isBioMolActive
      ? bioMolPhoneEdit.trim()
        ? 1
        : 0
      : activeList.filter((p) =>
          (activePhoneEdits[p.nome] || p.telefone).trim(),
        ).length;
  const withoutPhone = isAnalisesActive
    ? analisePhoneEdit.trim()
      ? 0
      : 1
    : isBioMolActive
      ? bioMolPhoneEdit.trim()
        ? 0
        : 1
      : activeList.length - withPhone;
  const selectedCount = isAnalisesActive
    ? analiseSelected
      ? 1
      : 0
    : isBioMolActive
      ? bioMolSelected
        ? 1
        : 0
      : activeSelectedIds.size;
  const canSend = isAnalisesActive
    ? selectedFilters.length > 0 &&
      template.trim().length > 0 &&
      analiseSelected &&
      analisePhoneEdit.trim().length > 0
    : isBioMolActive
      ? selectedFilters.length > 0 &&
        template.trim().length > 0 &&
        bioMolSelected &&
        bioMolPhoneEdit.trim().length > 0
      : selectedFilters.length > 0 &&
        template.trim().length > 0 &&
        selectedCount > 0 &&
        activeList.some(
          (p) =>
            activeSelectedIds.has(p.nome) &&
            (activePhoneEdits[p.nome] || p.telefone).trim(),
        ) &&
        !(
          modoEnvioIndividual &&
          previews.length > 0 &&
          selectedPreviewIds.size === 0
        );

  const filteredPreviews = previewSearchQuery.trim()
    ? previews.filter((p) =>
        [p.nome, p.telefone, p.message]
          .join(" ")
          .toLowerCase()
          .includes(previewSearchQuery.toLowerCase()),
      )
    : previews;

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
          background: "linear-gradient(to right, #eff6ff, #eef2ff, #f5f3ff)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
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
          Envie mensagens personalizadas para patologistas e clínicas
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
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>
              Selecionar Filtros
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
                    onClick={() => toggleFilterSelect(f.id)}
                    style={{
                      padding: "10px 12px",
                      border: `1px solid ${selectedFilterIds.has(f.id) ? "var(--blue)" : "var(--border)"}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      background: selectedFilterIds.has(f.id)
                        ? "rgba(59,130,246,0.08)"
                        : "var(--bg-2)",
                      transition: "all 0.2s",
                      boxShadow: selectedFilterIds.has(f.id)
                        ? "0 0 0 3px rgba(59,130,246,0.1)"
                        : "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFilterIds.has(f.id)}
                      onChange={() => toggleFilterSelect(f.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        marginTop: 2,
                        accentColor: "var(--blue)",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                  </div>
                ))}
              </div>
            )}

            {selectedFilters.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "var(--bg-2)",
                  borderRadius: 12,
                  fontSize: 12,
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "var(--text-0)",
                  }}
                >
                  Condições dos filtros:
                </div>
                {selectedFilters.map((sf) => (
                  <div key={sf.id} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--blue)",
                        marginBottom: 4,
                        fontSize: 11,
                      }}
                    >
                      {sf.name}
                    </div>
                    {sf.conditions.map((c: any, i: number) => (
                      <div
                        key={i}
                        style={{ color: "var(--text-2)", marginBottom: 2 }}
                      >
                        •{" "}
                        <span style={{ color: "var(--blue)" }}>{c.column}</span>{" "}
                        {c.operator}{" "}
                        <span style={{ color: "var(--green)" }}>{c.value}</span>
                        {c.value2 && ` — ${c.value2}`}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {selectedFilters.length > 0 &&
              selectedFilters.some((f) => f.selectedColumns.length > 0) && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "var(--bg-2)",
                    borderRadius: 12,
                    fontSize: 12,
                    border: "1px solid var(--border)",
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
                    {(() => {
                      const seen = new Set<string>();
                      const allCols: string[] = [];
                      for (const f of selectedFilters) {
                        for (const col of f.selectedColumns) {
                          if (!seen.has(col)) {
                            seen.add(col);
                            allCols.push(col);
                          }
                        }
                      }
                      return allCols.map((col) => (
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
                      ));
                    })()}
                  </div>
                </div>
              )}
          </div>

          {/* ===== SEÇÃO 2: Mensagem ===== */}
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>
              Mensagem —{" "}
              {isBioMolActive
                ? "Bio. Molecular"
                : isClinicActive
                  ? "Clínicas"
                  : "Patologistas"}
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
                      background: "rgba(59,130,246,0.08)",
                      border: "1px solid rgba(59,130,246,0.3)",
                      borderRadius: 20,
                      color: "var(--blue)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "monospace",
                      transition: "all 0.15s",
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
                background: "var(--bg-3)",
                border: "1px solid var(--border)",
                borderRadius: 12,
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
                selectedFilters.length === 0 ||
                !template.trim() ||
                selectedCount === 0 ||
                loadingPreview
              }
              style={{
                marginTop: 12,
                width: "100%",
                padding: "9px 16px",
                background: "var(--bg-3)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text-1)",
                cursor:
                  selectedFilters.length === 0 ||
                  !template.trim() ||
                  selectedCount === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  selectedFilters.length === 0 ||
                  !template.trim() ||
                  selectedCount === 0
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 8,
                    minHeight: 24,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-2)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Preview (
                    {modoEnvioIndividual
                      ? `${selectedPreviewIds.size} de ${filteredPreviews.length} selecionada(s)`
                      : `${filteredPreviews.length}${previewSearchQuery ? ` de ${previews.length}` : ""} mensagem(ns)`}
                    ):
                  </div>
                  {modoEnvioIndividual && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() =>
                          setSelectedPreviewIds(
                            new Set(previews.map((p) => p.id)),
                          )
                        }
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          background: "var(--bg-3)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          cursor: "pointer",
                          color: "var(--text-2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Selecionar todas
                      </button>
                      <button
                        onClick={() => setSelectedPreviewIds(new Set())}
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          background: "var(--bg-3)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          cursor: "pointer",
                          color: "var(--text-2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Desmarcar todas
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar nas mensagens..."
                  value={previewSearchQuery}
                  onChange={(e) => setPreviewSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "var(--bg-3)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text-1)",
                    fontSize: 12,
                    padding: "4px 8px",
                    outline: "none",
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    maxHeight: 500,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {filteredPreviews.map((p, i) => {
                    const isSelected =
                      !modoEnvioIndividual || selectedPreviewIds.has(p.id);
                    return (
                      <div
                        key={i}
                        style={{
                          background: "var(--bg-2)",
                          border: `1px solid ${isSelected ? "var(--border)" : "rgba(128,128,128,0.2)"}`,
                          borderRadius: 12,
                          padding: 10,
                          position: "relative",
                          // opacity: isSelected ? 1 : 0.45,
                          transition: "opacity 0.15s",
                        }}
                      >
                        {modoEnvioIndividual && (
                          <input
                            type="checkbox"
                            checked={selectedPreviewIds.has(p.id)}
                            onChange={() => {
                              setSelectedPreviewIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              });
                            }}
                            style={{
                              position: "absolute",
                              top: 10,
                              left: 10,
                              width: 15,
                              height: 15,
                              cursor: "pointer",
                            }}
                          />
                        )}
                        <button
                          onClick={() => {
                            navigator.clipboard
                              .writeText(p.message)
                              .then(() => {
                                setCopiedIndex(i);
                                setTimeout(() => setCopiedIndex(null), 2000);
                              });
                          }}
                          title="Copiar mensagem"
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            padding: "8px",
                            fontSize: 11,
                            background:
                              copiedIndex === i ? "var(--bg-3)" : "var(--bg-1)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            cursor: "pointer",
                            color:
                              copiedIndex === i
                                ? "var(--green)"
                                : "var(--text-3)",
                            transition: "all 0.15s",
                          }}
                        >
                          {copiedIndex === i ? "✓ Copiado" : "Copiar"}
                        </button>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-3)",
                            marginBottom: 6,
                            paddingRight: 70,
                            paddingLeft: modoEnvioIndividual ? 22 : 0,
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
                            paddingLeft: modoEnvioIndividual ? 22 : 0,
                          }}
                        >
                          {p.message}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ===== SEÇÃO 3: Patologistas / Clínicas ===== */}
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
          >
            {/* Tab header */}
            <div style={{ display: "flex", gap: 0, marginBottom: 12 }}>
              {(
                [
                  "patologistas",
                  "clinicas",
                  "bio-molecular",
                  "analises-clinicas",
                ] as const
              ).map((tab, idx) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSearchQuery("");
                  }}
                  style={{
                    padding: "6px 14px",
                    background:
                      activeTab === tab
                        ? "linear-gradient(to right, #3b82f6, #1d4ed8)"
                        : "var(--bg-2)",
                    border: "1px solid var(--border)",
                    borderRadius:
                      idx === 0
                        ? "8px 0 0 8px"
                        : idx === 3
                          ? "0 8px 8px 0"
                          : "0",
                    color: activeTab === tab ? "#fff" : "var(--text-2)",
                    fontSize: 12,
                    fontWeight: activeTab === tab ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow:
                      activeTab === tab
                        ? "0 2px 8px rgba(59,130,246,0.25)"
                        : "none",
                  }}
                >
                  {tab === "patologistas"
                    ? "Patologistas"
                    : tab === "clinicas"
                      ? "Clínicas"
                      : tab === "bio-molecular"
                        ? "Bio. Molecular"
                        : "Análises Clínicas"}
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

            {!isBioMolActive && !isAnalisesActive && (
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: 12,
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-0)",
                  marginBottom: 8,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            )}

            {!isBioMolActive && !isAnalisesActive && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  onClick={
                    activeTab === "clinicas"
                      ? selectAllClinicsWithPhone
                      : selectAllWithPhone
                  }
                  style={{
                    padding: "5px 10px",
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-1)",
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Selecionar todos com telefone
                </button>
                <button
                  onClick={
                    activeTab === "clinicas" ? deselectAllClinics : deselectAll
                  }
                  style={{
                    padding: "5px 10px",
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-1)",
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Desmarcar todos
                </button>
              </div>
            )}

            {/* Biologia Molecular */}
            {isBioMolActive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: bioMolSelected
                    ? "rgba(59,130,246,0.06)"
                    : "var(--bg-2)",
                  border: `1px solid ${bioMolSelected ? "var(--blue)" : "var(--border)"}`,
                  borderRadius: 12,
                  transition: "all 0.2s",
                  boxShadow: bioMolSelected
                    ? "0 0 0 2px rgba(59,130,246,0.1)"
                    : "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={bioMolSelected}
                  onChange={() => setBioMolSelected((v) => !v)}
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
                    background: bioMolPhoneEdit.trim()
                      ? "var(--green)"
                      : "var(--red)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-0)",
                      marginBottom: 3,
                    }}
                  >
                    Biologia Molecular
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <input
                      type="text"
                      placeholder="5511999999999"
                      value={bioMolPhoneEdit}
                      onChange={(e) => setBioMolPhoneEdit(e.target.value)}
                      onBlur={saveBioMolPhone}
                      onKeyDown={(e) => e.key === "Enter" && saveBioMolPhone()}
                      style={{
                        flex: 1,
                        background: "var(--bg-0)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--text-1)",
                        padding: "2px 6px",
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                    />
                    {savingBioMolPhone && (
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                        💾
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Análises Clínicas */}
            {isAnalisesActive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: analiseSelected
                    ? "rgba(59,130,246,0.06)"
                    : "var(--bg-2)",
                  border: `1px solid ${analiseSelected ? "var(--blue)" : "var(--border)"}`,
                  borderRadius: 12,
                  transition: "all 0.2s",
                  boxShadow: analiseSelected
                    ? "0 0 0 2px rgba(59,130,246,0.1)"
                    : "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={analiseSelected}
                  onChange={() => setAnaliseSelected((v) => !v)}
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
                    background: analisePhoneEdit.trim()
                      ? "var(--green)"
                      : "var(--red)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-0)",
                      marginBottom: 3,
                    }}
                  >
                    Análises Clínicas
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <input
                      type="text"
                      placeholder="5511999999999"
                      value={analisePhoneEdit}
                      onChange={(e) => setAnalisePhoneEdit(e.target.value)}
                      onBlur={saveAnalisePhone}
                      onKeyDown={(e) => e.key === "Enter" && saveAnalisePhone()}
                      style={{
                        flex: 1,
                        background: "var(--bg-0)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--text-1)",
                        padding: "2px 6px",
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                    />
                    {savingAnalisePhone && (
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                        💾
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Patologistas list */}
            {activeTab === "patologistas" &&
              (loadingPats ? (
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
                  {pathologists
                    .filter((pat) =>
                      pat.nome
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                    )
                    .map((pat) => {
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
                              ? "rgba(59,130,246,0.06)"
                              : "var(--bg-2)",
                            border: `1px solid ${isSelected ? "var(--blue)" : "var(--border)"}`,
                            borderRadius: 12,
                            transition: "all 0.2s",
                            boxShadow: isSelected
                              ? "0 0 0 2px rgba(59,130,246,0.1)"
                              : "none",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!hasPhone}
                            onChange={() => togglePatSelect(pat.nome)}
                            style={{
                              cursor: hasPhone ? "pointer" : "not-allowed",
                              accentColor: "var(--blue)",
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: hasPhone
                                ? "var(--green)"
                                : "var(--red)",
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
                                  borderRadius: 8,
                                  color: "var(--text-1)",
                                  padding: "2px 6px",
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                }}
                              />
                              {savingPhone === pat.nome && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: "var(--text-3)",
                                  }}
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
              ))}

            {/* Clínicas list */}
            {activeTab === "clinicas" &&
              (loadingClinics ? (
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
                  {clinics
                    .filter((clinic) =>
                      clinic.nome
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                    )
                    .map((clinic) => {
                      const tel =
                        clinicPhoneEdits[clinic.nome] ?? clinic.telefone;
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
                              ? "rgba(59,130,246,0.06)"
                              : "var(--bg-2)",
                            border: `1px solid ${isSelected ? "var(--blue)" : "var(--border)"}`,
                            borderRadius: 12,
                            transition: "all 0.2s",
                            boxShadow: isSelected
                              ? "0 0 0 2px rgba(59,130,246,0.1)"
                              : "none",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!hasPhone}
                            onChange={() => toggleClinicSelect(clinic.nome)}
                            style={{
                              cursor: hasPhone ? "pointer" : "not-allowed",
                              accentColor: "var(--blue)",
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: hasPhone
                                ? "var(--green)"
                                : "var(--red)",
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
                                value={
                                  clinicPhoneEdits[clinic.nome] ??
                                  clinic.telefone
                                }
                                onChange={(e) =>
                                  setClinicPhoneEdits((prev) => ({
                                    ...prev,
                                    [clinic.nome]: e.target.value,
                                  }))
                                }
                                onBlur={() => saveClinicPhone(clinic.nome)}
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  saveClinicPhone(clinic.nome)
                                }
                                style={{
                                  flex: 1,
                                  background: "var(--bg-0)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8,
                                  color: "var(--text-1)",
                                  padding: "2px 6px",
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                }}
                              />
                              {savingClinicPhone === clinic.nome && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: "var(--text-3)",
                                  }}
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
              ))}
          </div>
        </div>

        {/* ===== RODAPÉ: Enviar ===== */}
        <div
          style={{
            marginTop: 24,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{
                padding: "10px 28px",
                background:
                  canSend && !sending
                    ? "linear-gradient(to right, #3b82f6, #1d4ed8)"
                    : "var(--bg-3)",
                border: "none",
                borderRadius: 12,
                color: canSend && !sending ? "#fff" : "var(--text-3)",
                fontWeight: 600,
                fontSize: 14,
                cursor: canSend && !sending ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                boxShadow:
                  canSend && !sending
                    ? "0 4px 14px rgba(59,130,246,0.3)"
                    : "none",
              }}
            >
              {sending ? "⏳ Enviando..." : "📤 Enviar Mensagens"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label className="modo-individual-toggle">
                <input
                  type="checkbox"
                  checked={modoEnvioIndividual}
                  onChange={(e) => {
                    setModoEnvioIndividual(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedPreviewIds(new Set());
                      setPreviews([]);
                    }
                  }}
                />
                1 mensagem por linha
              </label>

              {selectedFilters.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  Selecione um ou mais filtros
                </span>
              )}
              {selectedFilters.length > 0 && !template.trim() && (
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  Escreva a mensagem
                </span>
              )}
              {selectedFilters.length > 0 &&
                template.trim() &&
                selectedCount === 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                    Selecione{" "}
                    {activeTab === "clinicas" ? "clínicas" : "patologistas"}
                  </span>
                )}
              {selectedFilters.length > 0 &&
                template.trim() &&
                selectedCount > 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                    Pronto para enviar para{" "}
                    <strong>
                      {
                        activeList.filter(
                          (p) =>
                            activeSelectedIds.has(p.nome) &&
                            (activePhoneEdits[p.nome] || p.telefone).trim(),
                        ).length
                      }
                    </strong>{" "}
                    {activeTab === "clinicas" ? "clínica(s)" : "patologista(s)"}
                  </span>
                )}
              {modoEnvioIndividual && previews.length > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    color:
                      selectedPreviewIds.size === 0
                        ? "var(--red)"
                        : "var(--text-2)",
                  }}
                >
                  {selectedPreviewIds.size === 0 ? (
                    "Nenhuma mensagem individual selecionada"
                  ) : (
                    <>
                      <strong>{selectedPreviewIds.size}</strong> de{" "}
                      <strong>{previews.length}</strong> mensagem(ns)
                      individual(is) selecionada(s)
                    </>
                  )}
                </span>
              )}
            </div>
          </div>

          {sending && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 6,
                  background: "var(--bg-3)",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: "linear-gradient(to right, #3b82f6, #1d4ed8)",
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
                      border: `1px solid ${r.success ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
                      borderRadius: 10,
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
