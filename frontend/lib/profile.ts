export const PROFILE_STORAGE_KEY = "travely-profile";

export type MaritalStatus =
  "solteiro" | "casado" | "uniao" | "divorciado" | "viuvo";

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
  { id: "solteiro", label: "Solteiro(a)" },
  { id: "casado", label: "Casado(a)" },
  { id: "uniao", label: "União estável" },
  { id: "divorciado", label: "Divorciado(a)" },
  { id: "viuvo", label: "Viúvo(a)" },
];

export const HOBBY_CHIPS = [
  "Caminhada",
  "Fotografia",
  "Culinária",
  "Leitura",
  "Jardim",
  "Dança",
  "Música",
  "Praia",
  "História",
  "Artesanato",
];

export const emptyProfile = (): TravelyProfile => ({
  name: "",
  email: "",
  birthDate: "",
  city: "",
  state: "",
  country: "Brasil",
  maritalStatus: "solteiro",
  hasMinorChildren: false,
  minorChildrenCount: 0,
  hobbies: [],
});

export function loadProfile(): TravelyProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TravelyProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: TravelyProfile): void {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function clearProfile(): void {
  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
