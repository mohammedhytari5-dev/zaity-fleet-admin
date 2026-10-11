-- Fix: accidents.najmReportNo was created NOT NULL DEFAULT '—' with a UNIQUE
-- constraint, while the application treats a missing Najm report as an optional
-- value (see server/accident-domain.ts `normalizeNajmReportNo`).
--
-- Two concrete failures resulted:
--   1. createAccident forwarded an explicit NULL into the NOT NULL column,
--      which MySQL rejects with ER_BAD_NULL_ERROR under STRICT_ALL_TABLES.
--      Every attempt to record an accident failed.
--   2. Even without that, the '—' default occupied the single UNIQUE slot, so
--      the second accident recorded without a report number failed with
--      ER_DUP_ENTRY.
--
-- The correct model: NULL means "report number not issued yet". MySQL treats
-- multiple NULLs as distinct, so the existing UNIQUE index keeps rejecting
-- duplicate real report numbers while allowing any number of unreported
-- accidents. The index is therefore intentionally left in place.

-- 1. Relax the column first (must happen before the sentinel back-fill).
ALTER TABLE `accidents` MODIFY COLUMN `najmReportNo` varchar(120) NULL;
--> statement-breakpoint
-- 2. Convert the legacy sentinel to NULL so it stops occupying the unique slot.
UPDATE `accidents` SET `najmReportNo` = NULL WHERE `najmReportNo` = '—';
--> statement-breakpoint
-- 3. Blank strings are not report numbers either.
UPDATE `accidents` SET `najmReportNo` = NULL WHERE TRIM(`najmReportNo`) = '';
