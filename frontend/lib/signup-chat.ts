import {
  LIMITS,
  MARITAL_OPTIONS,
  isValidBirthDate,
  isValidEmail,
  isFullName,
  type MaritalStatus,
  type TravelyProfile,
} from "@/lib/profile";
import type { SignupAnswer } from "@/services/api";

export function parseEmail(text: string): string | null {
  const match = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (match) return match[0].toLowerCase();

  const spoken = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+(at|arroba)\s+/g, "@")
    .replace(/\s+(dot|ponto)\s+/g, ".")
    .replace(/\s+/g, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spoken) ? spoken : null;
}

export function parseBirthDate(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const numeric = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  const left = numeric?.[1];
  const right = numeric?.[2];
  const year = numeric?.[3];
  if (left && right && year) {
    const a = Number(left);
    const b = Number(right);
    const [month, day] = a > 12 && b <= 12 ? [b, a] : [a, b];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
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
  const folded = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const named =
    folded.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/) ??
    folded.match(/(\d{1,2})\s+(?:of\s+)?([a-z]+)\s+(\d{4})/) ??
    folded.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (named) {
    const first = named[1];
    const second = named[2];
    const namedYear = named[3];
    if (!first || !second || !namedYear) return null;
    const monthKey = /^\d+$/.test(first) ? second : first;
    const dayRaw = /^\d+$/.test(first) ? first : second;
    const month = months[monthKey];
    if (!month) return null;
    return `${namedYear}-${month}-${dayRaw.padStart(2, "0")}`;
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
  if (n.includes("married") || n.includes("casad")) return "married";
  if (n.includes("single") || n.includes("solteir")) return "single";
  if (n.includes("widow") || n.includes("viuv")) return "widowed";
  if (n.includes("divorced") || n.includes("divorci")) return "divorced";
  if (
    n.includes("partnership") ||
    n.includes("together") ||
    n.includes("uniao") ||
    n.includes("junto")
  ) {
    return "partnership";
  }
  return null;
}

export function parseChildren(
  text: string,
): { hasMinorChildren: boolean; minorChildrenCount: number } | null {
  const n = text.toLowerCase();
  if (
    /\b(no|none|not|dont|zero|nao|não|nenhum|nenhuma)\b/.test(n) &&
    !/\d/.test(n)
  ) {
    return { hasMinorChildren: false, minorChildrenCount: 0 };
  }
  const count = n.match(/(\d+)/);
  if (count) {
    const nChildren = Math.min(LIMITS.children, Number(count[1]));
    return { hasMinorChildren: nChildren > 0, minorChildrenCount: nChildren };
  }
  if (/\b(yes|yeah|sim|tenho|filh)\b/.test(n)) return null;
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
    country: parts[2] ?? "Brazil",
  };
}

export function parseHobbies(text: string): string[] {
  return text
    .split(/[,;e]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

export type ChatField =
  | "name"
  | "email"
  | "birthDate"
  | "place"
  | "maritalStatus"
  | "children"
  | "hobbies";

export const CHAT_PROMPTS: Record<ChatField, string> = {
  name: "Hello. What is your full name?",
  email: "What is your email?",
  birthDate: "What day were you born? You can say 03/15/1952, for example.",
  place:
    "Where do you live? City, state, and country. You can write it in one sentence.",
  maritalStatus: "What is your marital status today?",
  children: "Do you have children under 18? If yes, how many?",
  hobbies: "What do you like to do? You can list a few hobbies.",
};

export const CHAT_ORDER: ChatField[] = [
  "name",
  "email",
  "birthDate",
  "place",
  "maritalStatus",
  "children",
  "hobbies",
];

export function shouldCallSignupModel(
  field: ChatField,
  applied: { ok: boolean },
): boolean {
  if (applied.ok) return false;
  // O modelo não inventa sobrenome. Repergunta na hora.
  return field !== "name";
}

export function applyChatAnswer(
  field: ChatField,
  text: string,
  profile: TravelyProfile,
): { ok: true; profile: TravelyProfile } | { ok: false; message: string } {
  if (field === "name") {
    const name = text.trim().slice(0, LIMITS.name);
    if (!isFullName(name)) {
      return {
        ok: false,
        message: "Please write your full name. First and last name.",
      };
    }
    return { ok: true, profile: { ...profile, name } };
  }
  if (field === "email") {
    const email = parseEmail(text);
    if (!email) {
      return {
        ok: false,
        message:
          "I could not find an email in that. Something like name@email.com.",
      };
    }
    return { ok: true, profile: { ...profile, email } };
  }
  if (field === "birthDate") {
    const birthDate = parseBirthDate(text);
    if (!birthDate || !isValidBirthDate(birthDate)) {
      return {
        ok: false,
        message: "I did not catch the date. You can use 03/15/1952.",
      };
    }
    return { ok: true, profile: { ...profile, birthDate } };
  }
  if (field === "place") {
    const place = parsePlace(text);
    if (!place.city) {
      return {
        ok: false,
        message:
          "Please say the city and the state. Example: Austin, Texas, United States.",
      };
    }
    return {
      ok: true,
      profile: {
        ...profile,
        city: place.city.slice(0, LIMITS.place),
        state: place.state.slice(0, LIMITS.place),
        country: (place.country || "Brazil").slice(0, LIMITS.place),
      },
    };
  }
  if (field === "maritalStatus") {
    const maritalStatus = parseMaritalStatus(text);
    if (!maritalStatus) {
      return {
        ok: false,
        message:
          "It can be single, married, domestic partnership, divorced, or widowed.",
      };
    }
    return { ok: true, profile: { ...profile, maritalStatus } };
  }
  if (field === "children") {
    const children = parseChildren(text);
    if (!children) {
      return {
        ok: false,
        message: "Please answer no, or yes and the number. Example: I have 2.",
      };
    }
    return { ok: true, profile: { ...profile, ...children } };
  }
  const hobbies = parseHobbies(text)
    .map((item) => item.slice(0, LIMITS.hobby))
    .filter((item) => item.length > 1)
    .slice(0, LIMITS.hobbies);
  if (hobbies.length === 0) {
    return {
      ok: false,
      message: "Tell me one or two things you like to do.",
    };
  }
  return { ok: true, profile: { ...profile, hobbies } };
}

/** Aplica ao perfil o que o modelo entendeu de UMA resposta.
 *
 *  A validação continua aqui, e não some porque agora existe uma IA no meio:
 *  `SignupAnswer` chega com o tipo certo (o schema garante), mas não com o
 *  valor certo. Email malformado e data impossível são recusados do mesmo
 *  jeito que eram com o parser local.
 */
export function applyInterpretedAnswer(
  field: ChatField,
  answer: SignupAnswer,
  profile: TravelyProfile,
): { ok: true; profile: TravelyProfile } | { ok: false; message: string } {
  if (field === "name") {
    const name = (answer.full_name ?? "").trim().slice(0, LIMITS.name);
    if (!isFullName(name)) {
      return {
        ok: false,
        message: "Please write your full name. First and last name.",
      };
    }
    return { ok: true, profile: { ...profile, name } };
  }

  if (field === "email") {
    const email = (answer.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return {
        ok: false,
        message:
          "I could not find an email in that. Something like name@email.com.",
      };
    }
    return { ok: true, profile: { ...profile, email } };
  }

  if (field === "birthDate") {
    const birthDate = answer.birth_date ?? "";
    if (!isValidBirthDate(birthDate)) {
      // Idade sem data é resposta parcial, não erro: reconhece o que veio e
      // pede só o que falta, em vez de mandar repetir tudo.
      if (answer.age != null) {
        return {
          ok: false,
          message: `Got it, ${answer.age} years old. And on what day and month were you born? You can use the calendar below.`,
        };
      }
      return {
        ok: false,
        message:
          "I did not catch the date. You can use 03/15/1952, or the calendar.",
      };
    }
    return { ok: true, profile: { ...profile, birthDate } };
  }

  if (field === "place") {
    const city = (answer.city ?? "").trim().slice(0, LIMITS.place);
    if (!city) {
      return {
        ok: false,
        message: "Please say the city and the state. Example: Austin, Texas.",
      };
    }
    return {
      ok: true,
      profile: {
        ...profile,
        city,
        state: (answer.state ?? "").trim().slice(0, LIMITS.place),
        country: (answer.country ?? "Brazil").trim().slice(0, LIMITS.place),
      },
    };
  }

  if (field === "maritalStatus") {
    if (!answer.marital_status) {
      return {
        ok: false,
        message:
          "It can be single, married, domestic partnership, divorced, or widowed. Or choose below.",
      };
    }
    return {
      ok: true,
      profile: { ...profile, maritalStatus: answer.marital_status },
    };
  }

  if (field === "children") {
    if (answer.has_minor_children == null) {
      return {
        ok: false,
        message: "Please answer no, or yes and how many. Example: I have 2.",
      };
    }
    const count = answer.has_minor_children
      ? Math.max(1, Math.min(LIMITS.children, answer.minor_children_count ?? 1))
      : 0;
    return {
      ok: true,
      profile: {
        ...profile,
        hasMinorChildren: answer.has_minor_children,
        minorChildrenCount: count,
      },
    };
  }

  const hobbies = answer.hobbies
    .map((item) => item.trim().slice(0, LIMITS.hobby))
    .filter((item) => item.length > 1)
    .slice(0, LIMITS.hobbies);
  if (hobbies.length === 0) {
    return {
      ok: false,
      message: "Tell me one or two things you like to do.",
    };
  }
  return { ok: true, profile: { ...profile, hobbies } };
}
