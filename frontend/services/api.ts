import type { RecommendationResponse } from "@/types/travel";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
  return `Request failed with status ${status}`;
}

export async function fetchRecommendations(
  text: string,
): Promise<RecommendationResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new Error(
      `Could not reach the API at ${API_BASE_URL}. Is the backend running?`,
    );
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(readErrorDetail(body, response.status));
  }

  return (await response.json()) as RecommendationResponse;
}
