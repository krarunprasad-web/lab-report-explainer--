import { config } from "../../config.js";
import type { Severity } from "./severityCalculator.js";

export interface ValueForExplanation {
  key: string;
  name: string;
  value: string;
  unit: string;
  status: Severity;
  ref: string;
}

export interface Explanation {
  key: string;
  plain: string;
  meaning: string;
  helps: string[];
}

const SYSTEM_PROMPT = `
You write plain-English explanations of laboratory test results for a patient reviewing their own report.

Rules:
1. Explain only the supplied laboratory values.
2. Never invent values or medical history.
3. Do not diagnose a disease.
4. The supplied status (high, low, borderline, or normal) has already been calculated. Do not contradict it.
5. Keep "plain" to one short sentence.
6. Keep "meaning" to 2-3 clear sentences.
7. Provide 1-3 practical suggestions in "helps".
8. For normal values, one short reassuring/actionable line is enough.
9. Use the reference range when useful.
10. Return ONLY valid JSON. No markdown and no explanation outside the JSON.

Return exactly:

{
  "explanations": [
    {
      "key": "",
      "plain": "",
      "meaning": "",
      "helps": []
    }
  ]
}
`;

function genericExplanation(v: ValueForExplanation): Explanation {
  const verdict =
    v.status === "normal"
      ? `Your ${v.name.toLowerCase()} is in range`
      : v.status === "borderline"
        ? `Your ${v.name.toLowerCase()} is borderline`
        : `Your ${v.name.toLowerCase()} is ${v.status}`;

  return {
    key: v.key,
    plain: verdict,
    meaning: `This measures ${v.name.toLowerCase()}. Reference range: ${v.ref}.`,
    helps:
      v.status === "normal"
        ? ["No specific action is needed for this result."]
        : ["Discuss this result with your doctor at your next visit."],
  };
}

function extractJson(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export async function explainValues(
  values: ValueForExplanation[],
): Promise<Map<string, Explanation>> {
  const result = new Map<string, Explanation>();

  if (values.length === 0) {
    return result;
  }

  if (!config.lovableAiSharedSecret) {
    throw new Error(
      "AI explanation is not configured. Set RAILWAY_AI_SHARED_SECRET.",
    );
  }

  const prompt = `
${SYSTEM_PROMPT}

LABORATORY VALUES
=================

${JSON.stringify(
  values.map((v) => ({
    key: v.key,
    name: v.name,
    value: v.value,
    unit: v.unit,
    status: v.status,
    ref: v.ref,
  })),
  null,
  2,
)}

Return ONLY the JSON object.
`;

  const response = await fetch(config.lovableAiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.lovableAiSharedSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Lovable AI explanation failed (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    text?: string;
    error?: {
      message?: string;
    };
  };

  if (data.error?.message) {
    throw new Error(`Lovable AI explanation error: ${data.error.message}`);
  }

  if (!data.text?.trim()) {
    throw new Error("Lovable AI returned an empty explanation response.");
  }

  try {
    const parsed = JSON.parse(extractJson(data.text)) as {
      explanations?: Explanation[];
    };

    if (Array.isArray(parsed.explanations)) {
      for (const explanation of parsed.explanations) {
        if (
          explanation &&
          typeof explanation.key === "string" &&
          typeof explanation.plain === "string" &&
          typeof explanation.meaning === "string" &&
          Array.isArray(explanation.helps)
        ) {
          result.set(explanation.key, {
            key: explanation.key,
            plain: explanation.plain,
            meaning: explanation.meaning,
            helps: explanation.helps.filter(
              (item): item is string => typeof item === "string",
            ),
          });
        }
      }
    }
  } catch (error) {
    throw new Error(
      `Lovable AI returned invalid explanation JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  // Safety fallback only for an individual explanation that AI omitted.
  // This is not a canned AI response for the whole request.
  for (const value of values) {
    if (!result.has(value.key)) {
      result.set(value.key, genericExplanation(value));
    }
  }

  return result;
}