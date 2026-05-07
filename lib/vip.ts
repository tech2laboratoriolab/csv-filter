import type { FilterCondition } from "@/lib/clientDb";

const VIP_MODE_KEY = "vip_mode";
const VIP_PARTNERS_KEY = "vip_partners";

export function getVipMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(VIP_MODE_KEY) === "true";
}

export function setVipMode(active: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIP_MODE_KEY, String(active));
}

export function getVipPartners(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(VIP_PARTNERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function setVipPartners(partners: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIP_PARTNERS_KEY, JSON.stringify(partners));
}

export function getVipFilterCondition(): FilterCondition | null {
  if (!getVipMode()) return null;
  const partners = getVipPartners();
  if (partners.length === 0) return null;
  return { column: "nom_local_origem", operator: "in", value: partners.join(",") };
}
