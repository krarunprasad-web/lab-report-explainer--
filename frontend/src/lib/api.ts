import type { ChatMessage, LabValue, ReportMeta } from "../types/value";
import { MOCK_REPORT_META, MOCK_VALUES, WALKTHROUGH_KEYS } from "./mockData";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? window.location.origin
).replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${API_BASE_URL}/api${path}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the real backend.
 *
 * IMPORTANT:
 * Authentication functions must NEVER fall back to fake/mock success.
 * A network failure is a real failure and must be reported as such.
 */
async function tryFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 2500,
): Promise<T> {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const data = (await res.json()) as T;

    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* AUTH                                                                       */
/* -------------------------------------------------------------------------- */

export interface LoginResult {
  ok: boolean;
  needsVerify: boolean;
  userId?: string;
  message?: string;
}

/**
 * Login always uses the real backend.
 *
 * NEVER return mock success here.
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    return await tryFetch<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    });
  } catch {
    return {
      ok: false,
      needsVerify: false,
      message: "Unable to connect to the server. Please try again.",
    };
  }
}

/**
 * Registration always uses the real backend.
 *
 * NEVER create a fake verified user when the backend is unavailable.
 */
export async function register(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    return await tryFetch<LoginResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    });
  } catch {
    return {
      ok: false,
      needsVerify: false,
      message: "Unable to connect to the server. Please try again.",
    };
  }
}

/**
 * Google authentication always uses the real backend.
 */
export async function continueWithGoogle(
  idToken: string,
): Promise<LoginResult> {
  try {
    return await tryFetch<LoginResult>("/auth/google", {
      method: "POST",
      body: JSON.stringify({
        idToken,
      }),
    });
  } catch {
    return {
      ok: false,
      needsVerify: false,
      message: "Unable to connect to the server. Please try again.",
    };
  }
}

/**
 * OTP verification.
 *
 * IMPORTANT:
 * The frontend ONLY validates the OTP FORMAT here.
 *
 * It does NOT decide whether the OTP is correct.
 *
 * The backend must verify:
 * - the user
 * - the stored OTP hash
 * - expiration
 * - attempt count
 * - consumedAt
 *
 * Therefore:
 *
 * 123456 -> sent to backend
 * 654321 -> sent to backend
 *
 * Neither is accepted merely because it has 6 digits.
 */
export async function verifyOtp(
  code: string,
  userId?: string,
): Promise<{ ok: boolean; message?: string }> {
  const normalizedCode = code.trim();

  // Client-side format validation only.
  // This does NOT mean the OTP is valid.
  if (!/^\d{6}$/.test(normalizedCode)) {
    return {
      ok: false,
      message: "Enter the 6-digit verification code.",
    };
  }

  try {
    // The REAL validation happens on the backend.
    return await tryFetch<{ ok: boolean; message?: string }>(
      "/auth/verify",
      {
        method: "POST",
        body: JSON.stringify({
          code: normalizedCode,
          userId,
        }),
      },
      5000,
    );
  } catch {
    // NEVER treat a network failure as a valid OTP.
    return {
      ok: false,
      message: "Unable to verify the code. Please try again.",
    };
  }
}

/**
 * Resend OTP through the real backend.
 *
 * Never pretend that an OTP was resent if the backend is unavailable.
 */
export async function resendOtp(): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    return await tryFetch<{ ok: boolean; message?: string }>(
      "/auth/verify/resend",
      {
        method: "POST",
      },
      5000,
    );
  } catch {
    return {
      ok: false,
      message: "Unable to resend the verification code. Please try again.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* REPORT UPLOAD                                                              */
/* -------------------------------------------------------------------------- */

export interface UploadResult {
  status: "ready" | "empty" | "partial" | "error";
  meta?: ReportMeta;
  values?: LabValue[];
  walkthroughKeys?: string[];
  matchedCount?: number;
  message?: string;
}

export async function uploadReport(
  files: File[],
): Promise<UploadResult> {
  try {
    const form = new FormData();

    for (const file of files) {
      form.append("files", file);
    }

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 30000);

    try {
      const res = await fetch(apiUrl("/reports/upload"), {
        method: "POST",
        body: form,
        credentials: "include",
        signal: controller.signal,
      });

      return (await res.json()) as UploadResult;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Report upload can still use the demo fallback because this is
    // non-authentication functionality.
    await delay(2200);

    return {
      status: "ready",
      meta: MOCK_REPORT_META,
      values: MOCK_VALUES,
      walkthroughKeys: WALKTHROUGH_KEYS,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* CHAT                                                                       */
/* -------------------------------------------------------------------------- */

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
): Promise<string> {
  try {
    const res = await tryFetch<{
      reply?: string;
      message?: string;
    }>("/chat/message", {
      method: "POST",
      body: JSON.stringify({
        message,
        history,
      }),
    });

    if (res.reply) {
      return res.reply;
    }

    if (res.message) {
      return `Something went wrong: ${res.message}`;
    }

    throw new Error("No reply from server");
  } catch {
    await delay(700);
    return canedReply(message);
  }
}

function canedReply(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("doctor")) {
    return "I can't reach the doctor-lookup service right now, so I can't pull real nearby results — but once it's connected I'll use your approximate location to suggest clinics near you.";
  }

  if (m.includes("eat") || m.includes("food")) {
    return 'Based on your panel, focus on iron-rich foods for your hemoglobin and less saturated fat for your LDL — see the "What helps" list on each flagged value for specifics.';
  }

  if (m.includes("tired") || m.includes("fatigue")) {
    return "Your hemoglobin is a bit low, which is a common cause of feeling tired — it's worth mentioning to your doctor alongside how you've been sleeping.";
  }

  if (m.includes("diabet")) {
    return "I can't diagnose anything — but your HbA1c is borderline, which is worth discussing with your doctor. It's not a diagnosis on its own.";
  }

  return "I can only speak to what's in your uploaded report. Could you ask about a specific value, like your LDL or HbA1c?";
}

/* -------------------------------------------------------------------------- */
/* RATING                                                                     */
/* -------------------------------------------------------------------------- */

export async function submitRating(
  score: number,
  comment: string,
): Promise<{ ok: boolean }> {
  try {
    return await tryFetch<{ ok: boolean }>("/rating", {
      method: "POST",
      body: JSON.stringify({
        score,
        comment,
      }),
    });
  } catch {
    await delay(300);
    return { ok: true };
  }
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

export function pdfExportUrl(): string {
  return `${API_BASE_URL}/api/reports/pdf`;
}

/* -------------------------------------------------------------------------- */
/* SESSION                                                                    */
/* -------------------------------------------------------------------------- */

export interface SessionInfo {
  authed: boolean;
  email?: string;
  hasSeenWalkthrough?: boolean;
}

/**
 * Session state must come from the real backend.
 */
export async function checkSession(): Promise<SessionInfo> {
  try {
    return await tryFetch<SessionInfo>(
      "/auth/me",
      {
        method: "GET",
      },
      3000,
    );
  } catch {
    return {
      authed: false,
    };
  }
}

/**
 * Best effort only.
 */
export async function markWalkthroughSeen(): Promise<void> {
  try {
    await tryFetch(
      "/auth/walkthrough-seen",
      {
        method: "POST",
      },
      1500,
    );
  } catch {
    // Local UI state can still reflect that the walkthrough was seen.
  }
}

/**
 * Logout must always go through the backend.
 */
export async function logout(): Promise<void> {
  try {
    await tryFetch(
      "/auth/logout",
      {
        method: "POST",
      },
      1500,
    );
  } catch {
    // Local state can still be cleared by the caller.
  }
}