-- CreateTable
CREATE TABLE "ReportSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "report" JSONB,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSession_userId_idx" ON "ReportSession"("userId");

-- CreateIndex
CREATE INDEX "ReportSession_lastActivityAt_idx" ON "ReportSession"("lastActivityAt");

-- AddForeignKey
ALTER TABLE "ReportSession" ADD CONSTRAINT "ReportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
