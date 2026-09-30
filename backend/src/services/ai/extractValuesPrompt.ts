import { config } from "../../config.js";
import type { RawExtractedValue } from "./mockReportData.js";

export interface ExtractionResult {
  reportDate: string;
  reportLabel: string;
  values: RawExtractedValue[];
  extractionConfidence: "high" | "partial" | "low";
  unrecognizedText: string[];
}

const SYSTEM_PROMPT = `You extract structured laboratory test results from raw OCR/parsed text of a medical lab report.

Lab report layouts vary widely, including tables, grouped sections, and multi-page scans.

Extract every distinct test result you can find with:
- test name
- value exactly as printed
- unit exactly as printed
- reference range exactly as printed
- section/category where the value appeared

IMPORTANT RULES:

1. Transcribe values exactly from the supplied report text.
2. Do not calculate, normalize, convert, or infer values.
3. Do not invent missing values.
4. Do not include patient identifying information such as name, ID, address, phone number, or email.
5. Extract only laboratory test results.
6. Preserve the printed reference range.
7. If the report date is present, extract it exactly as printed.
8. If the report label/panel name is present, extract it.
9. If a value cannot be confidently parsed, mention it in unrecognizedText.
10. If there are no recognizable laboratory values, return an empty values array.
11. Return ONLY valid JSON. Do not use markdown fences.
12. Do not add explanations before or after the JSON.

Return exactly this JSON structure:

{
  "reportDate": "",
  "reportLabel": "",
  "values": [
    {
      "name": "",
      "rawValue": "",
      "unit": "",
      "refRangeRaw": "",
      "category": ""
    }
  ],
  "extractionConfidence": "high",
  "unrecognizedText": []
}

extractionConfidence must be one of:
"high", "partial", "low"
`;

function emptyResult(): ExtractionResult {
  return {
    reportDate: "",
    reportLabel: "",
    values: [],
    extractionConfidence: "low",
    unrecognizedText: [],
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

function validateExtraction(value: unknown): ExtractionResult {
  if (!value || typeof value !== "object") {
    return emptyResult();
  }

  const data = value as Record<string, unknown>;

  const confidence =
    data.extractionConfidence === "high" ||
    data.extractionConfidence === "partial" ||
    data.extractionConfidence === "low"
      ? data.extractionConfidence
      : "low";

  const values = Array.isArray(data.values)
    ? data.values
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object",
        )
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          rawValue: String(item.rawValue ?? "").trim(),
          unit: String(item.unit ?? "").trim(),
          refRangeRaw: String(item.refRangeRaw ?? "").trim(),
          category: String(item.category ?? "").trim(),
        }))
        .filter(
          (item) =>
            item.name &&
            item.rawValue &&
            item.unit !== undefined &&
            item.refRangeRaw !== undefined,
        )
    : [];

  const unrecognizedText = Array.isArray(data.unrecognizedText)
    ? data.unrecognizedText
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return {
    reportDate: String(data.reportDate ?? "").trim(),
    reportLabel: String(data.reportLabel ?? "").trim(),
    values,
    extractionConfidence: confidence,
    unrecognizedText,
  };
}

export async function extractLabValues(
  rawText: string,
): Promise<ExtractionResult> {
  if (!rawText.trim()) {
    return emptyResult();
  }

  if (!config.lovableAiSharedSecret) {
    throw new Error(
      "AI extraction is not configured. Set RAILWAY_AI_SHARED_SECRET.",
    );
  }

  const prompt = `
${SYSTEM_PROMPT}

RAW LAB REPORT TEXT
===================

${rawText.slice(0, 60_000)}

===================

Extract the laboratory values from the raw text above.

Return ONLY the JSON object.
`;

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
      `Lovable AI extraction failed (${response.status}): ${errorText}`,
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
    throw new Error(`Lovable AI extraction error: ${data.error.message}`);
  }

  if (!data.text?.trim()) {
    throw new Error("Lovable AI returned an empty extraction response.");
  }

  try {
    const jsonText = extractJson(data.text);
    const parsed = JSON.parse(jsonText);

    return validateExtraction(parsed);
  } catch (error) {
    console.error("Invalid JSON returned by Lovable AI extraction:", data.text);

    throw new Error(
      `Lovable AI returned invalid extraction JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}