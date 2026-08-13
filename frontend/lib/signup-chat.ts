import { MARITAL_OPTIONS, type MaritalStatus } from "@/lib/profile";

export function parseEmail(text: string): string | null {
  const match = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return match ? match[0].toLowerCase() : null;
}

export function parseBirthDate(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const br = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  const brDay = br?.[1];
  const brMonth = br?.[2];
  const brYear = br?.[3];
  if (brDay && brMonth && brYear) {
    return `${brYear}-${brMonth.padStart(2, "0")}-${brDay.padStart(2, "0")}`;
  }

  const months: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    março: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };
  const named = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  const namedDay = named?.[1];
  const namedMonthKey = named?.[2];
  const namedYear = named?.[3];
  if (namedDay && namedMonthKey && namedYear) {
    const month = months[namedMonthKey];
    if (!month) return null;
    return `${namedYear}-${month}-${namedDay.padStart(2, "0")}`;
  }
  return null;
}

export function parseMaritalStatus(text: string): MaritalStatus | null {
  const n = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const option of MARITAL_OPTIONS) {
    if (
      n.includes(option.id) ||
      n.includes(option.label.toLowerCase().replace("(a)", ""))
    ) {
      return option.id;
    }
  }
  if (n.includes("casad")) return "casado";
  if (n.includes("solteir")) return "solteiro";
  if (n.includes("viuv")) return "viuvo";
  if (n.includes("divorci")) return "divorciado";
  if (n.includes("uniao") || n.includes("junto")) return "uniao";
  return null;
}

export function parseChildren(
  text: string,
): { hasMinorChildren: boolean; minorChildrenCount: number } | null {
  const n = text.toLowerCase();
  if (/\b(nao|não|nenhum|nenhuma|zero)\b/.test(n) && !/\d/.test(n)) {
    return { hasMinorChildren: false, minorChildrenCount: 0 };
  }
  const count = n.match(/(\d+)/);
  if (count) {
    const nChildren = Number(count[1]);
    return { hasMinorChildren: nChildren > 0, minorChildrenCount: nChildren };
  }
  if (/\b(sim|tenho|filh)/.test(n)) return null;
  return null;
}

export function parsePlace(text: string): {
  city: string;
  state: string;
  country: string;
} {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    city: parts[0] ?? "",
    state: parts[1] ?? "",
    country: parts[2] ?? "Brasil",
  };
}

export function parseHobbies(text: string): string[] {
  return text
    .split(/[,;e]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}
