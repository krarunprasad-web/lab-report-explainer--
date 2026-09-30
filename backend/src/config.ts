import "dotenv/config";

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

function parseOrigins(value: string | undefined): string[] {
  if (!value) return ["http://localhost:5173"];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: parseOrigins(process.env.FRONTEND_ORIGIN),
  nodeEnv: process.env.NODE_ENV ?? "development",
  idleTimeoutMs: Number(process.env.IDLE_TIMEOUT_MS ?? 15 * 60 * 1000),

  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret-change-me",
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET ?? "dev-refresh-secret-change-me",
  dataEncKey: process.env.DATA_ENC_KEY ?? "dev-data-enc-key-32-bytes-change",

lovableAiUrl:
  process.env.LOVABLE_AI_URL ??
  "https://project--5f1d4382-4872-497c-aca2-2c3f8d8dc2ad.lovable.app/api/public/railway-ai",

lovableAiSharedSecret: process.env.RAILWAY_AI_SHARED_SECRET || undefined,

mockAi: bool(process.env.MOCK_AI, false),

  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || undefined,

smtp: {
  host: process.env.SMTP_HOST || undefined,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: bool(process.env.SMTP_SECURE, true),
  user: process.env.SMTP_USER || undefined,
  pass: process.env.SMTP_PASS || undefined,
  from:
    process.env.SMTP_FROM ||
    `Lab Report Explainer <${process.env.SMTP_USER || "no-reply@example.com"}>`,
},
  devExposeOtp: bool(process.env.DEV_EXPOSE_OTP, true),

  ipGeoProvider: process.env.IPGEO_PROVIDER ?? "ip-api",
  devFallbackLocation: process.env.DEV_FALLBACK_LOCATION ?? "12.9716,77.5946",
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || undefined,

  ocrProvider: process.env.OCR_PROVIDER ?? "tesseract",
};
