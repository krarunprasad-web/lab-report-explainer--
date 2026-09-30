import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { config } from "../../config.js";
import { prisma } from "../../db/client.js";

export interface StoredLabValue {
  key: string;
  name: string;
  value: string;
  unit: string;
  status: "high" | "low" | "borderline" | "normal";
  ref: string;
  marker: number;
  bandA: number;
  bandB: number;
  plain: string;
  meaning: string;
  helps: string[];
  category?: string;
}

export interface SessionReport {
  meta: { label: string; date: string };
  values: StoredLabValue[];
  walkthroughKeys: string[];
}

interface SessionRecord {
  userId: string;
  report: SessionReport | null;
  lastActivityAt: number;
}

/**
 * Persistent session store backed by PostgreSQL.
 *
 * Sessions and extracted reports are stored in PostgreSQL so they
 * survive browser refreshes, backend restarts, and Railway deployments.
 */

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomUUID();

  await prisma.reportSession.create({
    data: {
      id: sessionId,
      userId,
      report: Prisma.JsonNull,
      lastActivityAt: new Date(),
    },
  });

  return sessionId;
}

export async function touchSession(sessionId: string): Promise<boolean> {
  const result = await prisma.reportSession.updateMany({
    where: {
      id: sessionId,
    },
    data: {
      lastActivityAt: new Date(),
    },
  });

  return result.count > 0;
}

export async function getSession(
  sessionId: string,
): Promise<SessionRecord | undefined> {
  const session = await prisma.reportSession.findUnique({
    where: {
      id: sessionId,
    },
  });

  if (!session) {
    return undefined;
  }

  return {
    userId: session.userId,
    report: session.report
      ? (session.report as unknown as SessionReport)
      : null,
    lastActivityAt: session.lastActivityAt.getTime(),
  };
}

export async function setReport(
  sessionId: string,
  report: SessionReport,
): Promise<void> {
  await prisma.reportSession.updateMany({
    where: {
      id: sessionId,
    },
    data: {
      report: report as unknown as Prisma.InputJsonValue,
      lastActivityAt: new Date(),
    },
  });
}

export async function getReport(
  sessionId: string,
): Promise<SessionReport | null> {
  const session = await prisma.reportSession.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      report: true,
    },
  });

  if (!session?.report) {
    return null;
  }

  return session.report as unknown as SessionReport;
}

export async function clearSession(sessionId: string): Promise<void> {
  await prisma.reportSession.deleteMany({
    where: {
      id: sessionId,
    },
  });
}

export async function sweepIdleSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - config.idleTimeoutMs);

  await prisma.reportSession.deleteMany({
    where: {
      lastActivityAt: {
        lt: cutoff,
      },
    },
  });
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startSessionSweeper() {
  if (sweepTimer) return;

  sweepTimer = setInterval(() => {
    void sweepIdleSessions().catch((error) => {
      console.error("Failed to sweep idle sessions:", error);
    });
  }, 5 * 60_000);

  sweepTimer.unref?.();
}