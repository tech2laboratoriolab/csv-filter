import { readFileSync } from "fs";
import { join } from "path";
import { google } from "googleapis";

export interface PromptItem {
  id: string;
  name: string;
  description: string;
  text: string;
  defaultColumn?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PromptsConfig {
  version?: string;
  source?: "drive" | "local";
  defaultTemplate: string;
  batchInstruction: string;
  prompts: PromptItem[];
}

const DRIVE_FILE_NAME = "csv-filter-prompts.json";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

let cache: { data: PromptsConfig; fetchedAt: number } | null = null;

function loadLocalFallback(): PromptsConfig {
  const raw = readFileSync(
    join(process.cwd(), "public/csv-filter-prompts.json"),
    "utf-8",
  );
  return JSON.parse(raw) as PromptsConfig;
}

function buildAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

async function fetchFromDrive(): Promise<PromptsConfig> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const auth = buildAuth();
  const drive = google.drive({ version: "v3", auth });

  // Localiza o arquivo pelo nome dentro da pasta
  const listRes = await drive.files.list({
    q: `'${folderId}' in parents and name = '${DRIVE_FILE_NAME}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const fileId = listRes.data.files?.[0]?.id;
  if (!fileId) {
    throw new Error(
      `Arquivo '${DRIVE_FILE_NAME}' não encontrado na pasta do Google Drive (id: ${folderId})`,
    );
  }

  // Baixa o conteúdo do arquivo usando o token da service account
  await auth.authorize();
  const { token } = await auth.getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo do Drive: HTTP ${res.status}`);
  }

  const data = (await res.json()) as PromptsConfig;
  return { ...data, source: "drive" };
}

export async function getPromptsConfig(): Promise<PromptsConfig> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (folderId) {
    try {
      const data = await fetchFromDrive();
      cache = { data, fetchedAt: Date.now() };
      return data;
    } catch (err) {
      console.warn(
        "[promptsConfig] Falha ao buscar Google Drive, usando fallback:",
        err,
      );
    }
  }

  const data = { ...loadLocalFallback(), source: "local" as const };
  cache = { data, fetchedAt: Date.now() };
  return data;
}
