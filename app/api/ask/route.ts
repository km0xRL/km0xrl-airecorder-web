import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { apiError, jsonResponse, readTextLimited, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AskServiceError, askArchive, type AskHistoryItem } from "@/lib/ask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  if (!sameOrigin(request)) return apiError(403, "bad_origin", "Чужой источник запроса");

  const limit = rateLimit("ask:owner", 8, 60_000);
  if (!limit.ok) {
    return apiError(429, "rate_limited", "Слишком много вопросов подряд — подождите минуту", {
      retry_after_s: limit.retryAfterSec,
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(await readTextLimited(request, 32 * 1024));
  } catch {
    return apiError(400, "bad_json", "Неверный JSON");
  }
  if (!body || typeof body !== "object") return apiError(400, "bad_json", "Неверный JSON");
  const input = body as {
    question?: unknown;
    history?: unknown;
    recordingId?: unknown;
  };

  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (!question) return apiError(400, "no_question", "Напишите вопрос");
  if (question.length > 2_000) return apiError(400, "too_long", "Вопрос длиннее 2000 символов");

  const history: AskHistoryItem[] = [];
  if (Array.isArray(input.history)) {
    for (const raw of input.history.slice(-6)) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as { role?: unknown; content?: unknown };
      if (item.role !== "user" && item.role !== "assistant") continue;
      if (typeof item.content !== "string") continue;
      const content = item.content.trim().slice(0, 4_000);
      if (content) history.push({ role: item.role, content });
    }
  }

  const recordingId =
    typeof input.recordingId === "string" && input.recordingId.trim()
      ? input.recordingId.trim().slice(0, 100)
      : null;

  try {
    const result = await askArchive({ question, history, recordingId });
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof AskServiceError) {
      console.error("[ask]", error.code, error.status, error.message);
      if (error.code === "not_configured" || error.code === "ask_disabled") {
        return apiError(503, error.code, "LLM не настроен на сервере");
      }
      if (error.code === "empty_library" || error.code === "empty_context") {
        return apiError(400, error.code, error.message);
      }
      if (error.code === "not_found") return apiError(404, error.code, error.message);
      if (error.code === "too_large") return apiError(413, error.code, error.message);
      if (error.code === "timeout") return apiError(504, error.code, error.message);
      if (error.code === "llm_auth" || error.code === "llm_http_401" || error.code === "llm_http_403") {
        return apiError(502, "llm_auth", "LLM-сервис не принял токен");
      }
      return apiError(502, error.code, error.message);
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return apiError(504, "timeout", "LLM не ответил вовремя");
    }
    console.error("[ask] unexpected", error);
    return apiError(502, "llm_unavailable", "Не удалось получить ответ от LLM");
  }
}
