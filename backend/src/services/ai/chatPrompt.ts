import { config } from "../../config.js";
import type { SessionReport } from "../sessionStore/inMemoryStore.js";
import { lookupDoctors } from "../doctor/placesService.js";

export interface ChatTurn {
  role: "user" | "bot";
  text: string;
}

const SYSTEM_PROMPT_TEMPLATE = (report: SessionReport) => `
You are the AI assistant inside Lab Report Explainer.

Your job is to help the patient understand THEIR uploaded laboratory report.

IMPORTANT RULES:

1. Answer the user's actual question.
2. Use the laboratory report below as the source for patient-specific values.
3. Never invent, guess, or change laboratory values.
4. If the user asks about a value, use the exact value contained in the report.
5. If a requested value is not present in the report, clearly say that it is not available in the uploaded report.
6. You may explain what a laboratory result generally means in plain language.
7. Do not diagnose diseases or medical conditions.
8. Do not claim that the patient definitely has a disease.
9. Do not invent symptoms, medical history, medications, age, sex, or other personal information.
10. If a result may deserve medical attention, recommend discussing it with a qualified healthcare professional.
11. Use previous conversation context when answering follow-up questions.
12. Do not repeat the same generic answer when the user's question is different.
13. Keep normal answers concise, usually 2-5 sentences.
14. Use clear, simple language.
15. When useful, mention the patient's actual result and reference range.
16. If the question is unrelated to the uploaded report, explain that you can only help with questions related to the uploaded report.
17. Never fabricate information just to provide an answer.

UPLOADED REPORT
================

Report date:
${report.meta.date}

Laboratory values:
${
  report.values.length > 0
    ? report.values
        .map(
          (v) =>
            `- ${v.name}: ${v.value} ${v.unit} | Status: ${v.status} | Reference: ${v.ref} | Explanation: ${v.plain}`,
        )
        .join("\n")
    : "No laboratory values were extracted from the uploaded report."
}

================

The report above is the authoritative source for patient-specific laboratory values.

If the user asks to find a doctor, clinic, or physician nearby, use the doctor lookup capability instead of inventing a recommendation from the report.
`;

function isDoctorRequest(message: string): boolean {
  return /\b(doctor|clinic|physician)\b/i.test(message);
}

export async function chatReply(
  report: SessionReport,
  history: ChatTurn[],
  message: string,
  clientIp: string,
): Promise<string> {
  /*
   * Doctor lookup remains separate from AI.
   */
  if (isDoctorRequest(message)) {
    return lookupDoctors(clientIp);
  }

  /*
   * Build the complete prompt for Lovable AI.
   */
  const recentHistory = history.slice(-12);

  const conversation = recentHistory
    .map(
      (turn) =>
        `${turn.role === "bot" ? "Assistant" : "User"}: ${turn.text}`,
    )
    .join("\n");

  const prompt = `
${SYSTEM_PROMPT_TEMPLATE(report)}

CONVERSATION HISTORY
====================

${conversation || "No previous conversation."}

CURRENT USER QUESTION
=====================

${message}

Answer the current user's question using the uploaded report as the source of truth.
`;

  if (!config.lovableAiSharedSecret) {
    throw new Error(
      "AI assistant is not configured. Set RAILWAY_AI_SHARED_SECRET.",
    );
  }

  const response = await fetch(config.lovableAiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.lovableAiSharedSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Lovable AI request failed (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    text?: string;
    model?: string;
    error?: {
      message?: string;
    };
  };

  if (data.error?.message) {
    throw new Error(`Lovable AI error: ${data.error.message}`);
  }

  if (!data.text?.trim()) {
    throw new Error("Lovable AI returned an empty response.");
  }

  return data.text.trim();
}