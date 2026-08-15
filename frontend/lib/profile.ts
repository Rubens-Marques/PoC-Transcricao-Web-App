export const PROFILE_STORAGE_KEY = "travely-profile";

export const LIMITS = {
  name: 80,
  email: 120,
  place: 80,
  hobby: 40,
  hobbies: 12,
  children: 20,
  chat: 280,
} as const;

export type MaritalStatus =
  "single" | "married" | "partnership" | "divorced" | "widowed";

export type TravelyProfile = {
  name: string;
  email: string;
  birthDate: string;
  city: string;
  state: string;
  country: string;
  maritalStatus: MaritalStatus;
  hasMinorChildren: boolean;
  minorChildrenCount: number;
  hobbies: string[];
};

export const MARITAL_OPTIONS: { id: MaritalStatus; label: string }[] = [
  { id: "single", label: "Single" },
  { id: "married", label: "Married" },
  { id: "partnership", label: "Domestic partnership" },
  { id: "divorced", label: "Divorced" },
  { id: "widowed", label: "Widowed" },
];

const MARITAL_IDS = new Set<MaritalStatus>(
  MARITAL_OPTIONS.map((option) => option.id),
);

export const HOBBY_CHIPS = [
  "Walking",
  "Photography",
  "Cooking",
  "Reading",
  "Gardening",
  "Dancing",
  "Music",
  "Beach",
  "History",
  "Crafts",
];

export const emptyProfile = (): TravelyProfile => ({
  name: "",
  email: "",
  birthDate: "",
  city: "",
  state: "",
  country: "Brazil",
  maritalStatus: "single",
  hasMinorChildren: false,
  minorChildrenCount: 0,
  hobbies: [],
});

/** Nome completo: pelo menos duas palavras. "Maria" não passa; "Maria Silva" passa. */
export function isFullName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > LIMITS.name) return false;
  const parts = trimmed
    .split(/\s+/)
    .filter((part) => part.replace(/[^\p{L}]/gu, "").length > 0);
  return parts.length >= 2;
}

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (email.length > LIMITS.email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidBirthDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return false;
  }
  if (year < 1900) return false;
  return parsed.getTime() <= Date.now();
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function asString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  return clip(value, max);
}

export function parseStoredProfile(raw: unknown): TravelyProfile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const name = asString(data.name, LIMITS.name);
  const email = asString(data.email, LIMITS.email);
  const birthDate = asString(data.birthDate, 10);
  const city = asString(data.city, LIMITS.place);
  const state = asString(data.state, LIMITS.place);
  const country = asString(data.country, LIMITS.place) ?? "Brazil";
  const maritalStatus = data.maritalStatus;
  const hobbiesRaw = data.hobbies;

  if (!name || !isFullName(name)) return null;
  if (!email || !isValidEmail(email)) return null;
  if (!birthDate || !isValidBirthDate(birthDate)) return null;
  if (!city || !state) return null;
  if (
    typeof maritalStatus !== "string" ||
    !MARITAL_IDS.has(maritalStatus as MaritalStatus)
  ) {
    return null;
  }
  if (typeof data.hasMinorChildren !== "boolean") return null;
  if (
    typeof data.minorChildrenCount !== "number" ||
    !Number.isInteger(data.minorChildrenCount) ||
    data.minorChildrenCount < 0 ||
    data.minorChildrenCount > LIMITS.children
  ) {
    return null;
  }
  if (!Array.isArray(hobbiesRaw)) return null;

  const hobbies = hobbiesRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => clip(item, LIMITS.hobby))
    .filter((item) => item.length > 1)
    .slice(0, LIMITS.hobbies);

  if (hobbies.length === 0) return null;

  return {
    name,
    email: email.toLowerCase(),
    birthDate,
    city,
    state,
    country: country || "Brazil",
    maritalStatus: maritalStatus as MaritalStatus,
    hasMinorChildren: data.hasMinorChildren,
    minorChildrenCount: data.hasMinorChildren ? data.minorChildrenCount : 0,
    hobbies,
  };
}

export function clipProfile(profile: TravelyProfile): TravelyProfile {
  return {
    ...profile,
    name: clip(profile.name, LIMITS.name),
    email: clip(profile.email, LIMITS.email).toLowerCase(),
    city: clip(profile.city, LIMITS.place),
    state: clip(profile.state, LIMITS.place),
    country: clip(profile.country, LIMITS.place) || "Brazil",
    minorChildrenCount: Math.min(
      LIMITS.children,
      Math.max(0, Math.trunc(profile.minorChildrenCount)),
    ),
    hobbies: profile.hobbies
      .map((item) => clip(item, LIMITS.hobby))
      .filter((item) => item.length > 1)
      .slice(0, LIMITS.hobbies),
  };
}

export function loadProfile(): TravelyProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return parseStoredProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveProfile(profile: TravelyProfile): void {
  window.localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(clipProfile(profile)),
  );
}

export function clearProfile(): void {
  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function validateWizardStep(
  step: number,
  profile: TravelyProfile,
): string | null {
  if (step === 1 && !isFullName(profile.name)) {
    return "Please write your full name. First and last name.";
  }
  if (step === 2 && !isValidEmail(profile.email)) {
    return "That email looks incomplete. It needs an @ and the part after it.";
  }
  if (step === 3 && !isValidBirthDate(profile.birthDate)) {
    return "Please choose the day, month, and year.";
  }
  if (
    step === 4 &&
    (!clip(profile.city, LIMITS.place) || !clip(profile.state, LIMITS.place))
  ) {
    return "Please write the city and the state.";
  }
  if (step === 7 && profile.hobbies.length === 0) {
    return "Please choose at least one thing you like to do.";
  }
  return null;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}
