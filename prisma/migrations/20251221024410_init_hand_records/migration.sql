-- CreateTable
CREATE TABLE "hand_records" (
    "hand_id" UUID NOT NULL,
    "table_id" TEXT NOT NULL,
    "played_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "stakes_sb" INTEGER NOT NULL,
    "stakes_bb" INTEGER NOT NULL,
    "hero_seat" INTEGER NOT NULL,
    "hero_net_result" BIGINT NOT NULL DEFAULT 0,
    "winner_count" INTEGER NOT NULL DEFAULT 0,
    "auto_win" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,

    CONSTRAINT "hand_records_pkey" PRIMARY KEY ("hand_id")
);

-- CreateIndex
CREATE INDEX "hand_records_table_id_played_at_hand_id_idx" ON "hand_records"("table_id", "played_at" DESC, "hand_id" DESC);
