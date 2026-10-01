import type { ChatMessage, LabValue, ReportMeta } from "../types/value";

const API_BASE_URL = window.location.origin;

function apiUrl(path: string): string {
  return `${API_BASE_URL}/api${path}`;
}

/**
 * Calls the real backend.
 *
 * Authentication and AI operations never fall back to fake success.
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

/* -------------------------------------------------------------------------- */
/* OTP                                                                        */
/* -------------------------------------------------------------------------- */

export async function verifyOtp(
  code: string,
  userId?: string,
): Promise<{ ok: boolean; message?: string }> {
  const normalizedCode = code.trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return {
      ok: false,
      message: "Enter the 6-digit verification code.",
    };
  }

  try {
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
    return {
      ok: false,
      message: "Unable to verify the code. Please try again.",
    };
  }
}

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
  const form = new FormData();

  for (const file of files) {
    form.append("files", file);
  }

  try {
    /**
     * No artificial timeout here.
     *
     * PDF extraction + AI extraction + AI explanations can legitimately
     * take longer than 30 seconds.
     */
    const res = await fetch(apiUrl("/reports/upload"), {
      method: "POST",
      body: form,
      credentials: "include",
    });

    let data: UploadResult;

    try {
      data = (await res.json()) as UploadResult;
    } catch {
      return {
        status: "error",
        message: `Upload failed with HTTP ${res.status}.`,
      };
    }

    /**
     * Never convert a failed backend request into fake report data.
     */
    if (!res.ok) {
      return {
        status: "error",
        message:
          data.message ||
          `Upload failed with HTTP ${res.status}.`,
      };
    }

    return data;
  } catch (error) {
    console.error("REPORT UPLOAD FAILED:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to upload the report. Please try again.",
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
    }>(
      "/chat/message",
      {
        method: "POST",
        body: JSON.stringify({
          message,
          history,
        }),
      },
      30000,
    );

    if (res.reply) {
      return res.reply;
    }

    if (res.message) {
      return `Something went wrong: ${res.message}`;
    }

    return "I couldn't get a response from the assistant. Please try again.";
  } catch {
    return "The assistant is temporarily unavailable. Please try again.";
  }
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
    return { ok: false };
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
    // Best effort only.
  }
}

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
    // Best effort only.
  }
}