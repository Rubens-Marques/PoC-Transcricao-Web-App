import type { MaritalStatus } from "@/lib/profile";
import type { ChatField } from "@/lib/signup-chat";
import type { RecommendationResponse } from "@/types/travel";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type PlaceLookup = {
  city: string;
  state: string;
  country: string;
};

/** FastAPI returns `{detail: string}` for HTTPException and `{detail: [...]}`
 *  for validation errors. Reduce both to one readable line. */
function readErrorDetail(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const { detail } = body as { detail: unknown };
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          typeof item === "object" && item !== null && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : null,
        )
        .filter((message): message is string => message !== null);
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
  }
  if (status === 502 || status === 503) {
    return "The service is busy. Please try again in a moment.";
  }
  return "I could not finish that now. Please try again.";
}

async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw caught;
    }
    throw new Error("I could not reach the server. Please try again.");
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(readErrorDetail(payload, response.status));
  }

  return (await response.json()) as T;
}

export async function fetchRecommendations(
  text: string,
): Promise<RecommendationResponse> {
  return postJson<RecommendationResponse>("/api/recommendations", { text });
}

export async function lookupPlace(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<PlaceLookup> {
  return postJson<PlaceLookup>("/api/place", { lat, lon }, signal);
}

/** Espelha SignupAnswer em backend/models/signup.py. */
export type SignupAnswer = {
  full_name: string | null;
  email: string | null;
  birth_date: string | null;
  age: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  marital_status: MaritalStatus | null;
  has_minor_children: boolean | null;
  minor_children_count: number | null;
  hobbies: string[];
};

/** Manda a resposta do cadastro conversado para o modelo entender.
 *  Quem chama trata a falha: o cadastro nunca pode parar porque a IA caiu. */
export async function interpretSignupAnswer(
  field: ChatField,
  text: string,
  signal?: AbortSignal,
): Promise<SignupAnswer> {
  const body = await postJson<{ answer: SignupAnswer }>(
    "/api/signup/interpret",
    { field, text },
    signal,
  );
  return body.answer;
}
