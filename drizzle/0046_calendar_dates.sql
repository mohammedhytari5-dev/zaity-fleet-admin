-- Calendar dates: 23 text columns become real DATE columns.
--
-- The columns were varchar(32) and held a mix of 'YYYY-MM-DD', 'd/m/yyyy',
-- the sentinel '—', empty strings and NULL. Because they were text, report
-- period filters compared them lexicographically: a row stored as "1/5/2026"
-- sorted before "2026-06-01" and was silently excluded from June reports, and
-- the '—' sentinel was included or excluded by codepoint accident.
--
-- Each column is normalised in one idempotent statement before its type change,
-- because MySQL rejects the sentinel and unparsable values when converting to
-- DATE (verified: CAST('01/01/2028' AS DATE) returns NULL), and MySQL commits
-- DDL implicitly, so a failure part-way could not be rolled back.
--
-- The set of columns was derived from the live database (every varchar column
-- was listed and classified), not from a name pattern.
--
-- All columns become nullable with no default: NULL means "not set", which a
-- DATE column can represent and the '—' sentinel cannot.
--
-- Note for MySQL 8: `date` needs mode: "string" in Drizzle, which keeps the
-- TypeScript type as string so existing formatting and parsing code is unchanged.

ALTER TABLE `accidents` MODIFY COLUMN `occurredAt` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `due` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `submittedAt` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `followUpAt` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `startDate` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `expiry` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `expiry` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `drivers` MODIFY COLUMN `renewal` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `employees` MODIFY COLUMN `hireDate` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `start` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `due` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `expectedReturn` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `warrantyUntil` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `payable_payments` MODIFY COLUMN `paidAt` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `payables` MODIFY COLUMN `issueDate` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `payables` MODIFY COLUMN `dueDate` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `paidAt` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `startDate` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `endDate` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `dueAt` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `vehicle_expenses` MODIFY COLUMN `spentAt` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `vehicles` MODIFY COLUMN `purchaseDate` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `vehicles` MODIFY COLUMN `inServiceDate` varchar(32) NULL;
--> statement-breakpoint
UPDATE `accidents` SET `occurredAt` = CASE
    WHEN `occurredAt` IS NULL OR TRIM(`occurredAt`) = '' OR TRIM(`occurredAt`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`occurredAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`occurredAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`occurredAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`occurredAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `occurredAt`
  END
  WHERE `occurredAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `claims` SET `due` = CASE
    WHEN `due` IS NULL OR TRIM(`due`) = '' OR TRIM(`due`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `due`
  END
  WHERE `due` IS NOT NULL;
--> statement-breakpoint
UPDATE `claims` SET `submittedAt` = CASE
    WHEN `submittedAt` IS NULL OR TRIM(`submittedAt`) = '' OR TRIM(`submittedAt`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`submittedAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`submittedAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`submittedAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`submittedAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `submittedAt`
  END
  WHERE `submittedAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `claims` SET `followUpAt` = CASE
    WHEN `followUpAt` IS NULL OR TRIM(`followUpAt`) = '' OR TRIM(`followUpAt`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`followUpAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`followUpAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`followUpAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`followUpAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `followUpAt`
  END
  WHERE `followUpAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `contracts` SET `startDate` = CASE
    WHEN `startDate` IS NULL OR TRIM(`startDate`) = '' OR TRIM(`startDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `startDate`
  END
  WHERE `startDate` IS NOT NULL;
--> statement-breakpoint
UPDATE `contracts` SET `expiry` = CASE
    WHEN `expiry` IS NULL OR TRIM(`expiry`) = '' OR TRIM(`expiry`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `expiry`
  END
  WHERE `expiry` IS NOT NULL;
--> statement-breakpoint
UPDATE `documents` SET `expiry` = CASE
    WHEN `expiry` IS NULL OR TRIM(`expiry`) = '' OR TRIM(`expiry`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expiry`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `expiry`
  END
  WHERE `expiry` IS NOT NULL;
--> statement-breakpoint
UPDATE `drivers` SET `renewal` = CASE
    WHEN `renewal` IS NULL OR TRIM(`renewal`) = '' OR TRIM(`renewal`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`renewal`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`renewal`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`renewal`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`renewal`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `renewal`
  END
  WHERE `renewal` IS NOT NULL;
--> statement-breakpoint
UPDATE `employees` SET `hireDate` = CASE
    WHEN `hireDate` IS NULL OR TRIM(`hireDate`) = '' OR TRIM(`hireDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`hireDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`hireDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`hireDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`hireDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `hireDate`
  END
  WHERE `hireDate` IS NOT NULL;
--> statement-breakpoint
UPDATE `maintenance_requests` SET `start` = CASE
    WHEN `start` IS NULL OR TRIM(`start`) = '' OR TRIM(`start`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`start`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`start`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`start`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`start`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `start`
  END
  WHERE `start` IS NOT NULL;
--> statement-breakpoint
UPDATE `maintenance_requests` SET `due` = CASE
    WHEN `due` IS NULL OR TRIM(`due`) = '' OR TRIM(`due`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`due`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `due`
  END
  WHERE `due` IS NOT NULL;
--> statement-breakpoint
UPDATE `maintenance_requests` SET `expectedReturn` = CASE
    WHEN `expectedReturn` IS NULL OR TRIM(`expectedReturn`) = '' OR TRIM(`expectedReturn`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expectedReturn`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expectedReturn`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expectedReturn`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`expectedReturn`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `expectedReturn`
  END
  WHERE `expectedReturn` IS NOT NULL;
--> statement-breakpoint
UPDATE `maintenance_requests` SET `warrantyUntil` = CASE
    WHEN `warrantyUntil` IS NULL OR TRIM(`warrantyUntil`) = '' OR TRIM(`warrantyUntil`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`warrantyUntil`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`warrantyUntil`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`warrantyUntil`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`warrantyUntil`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `warrantyUntil`
  END
  WHERE `warrantyUntil` IS NOT NULL;
--> statement-breakpoint
UPDATE `payable_payments` SET `paidAt` = CASE
    WHEN `paidAt` IS NULL OR TRIM(`paidAt`) = '' OR TRIM(`paidAt`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `paidAt`
  END
  WHERE `paidAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `payables` SET `issueDate` = CASE
    WHEN `issueDate` IS NULL OR TRIM(`issueDate`) = '' OR TRIM(`issueDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`issueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`issueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`issueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`issueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `issueDate`
  END
  WHERE `issueDate` IS NOT NULL;
--> statement-breakpoint
UPDATE `payables` SET `dueDate` = CASE
    WHEN `dueDate` IS NULL OR TRIM(`dueDate`) = '' OR TRIM(`dueDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `dueDate`
  END
  WHERE `dueDate` IS NOT NULL;
--> statement-breakpoint
UPDATE `payments` SET `paidAt` = CASE
    WHEN `paidAt` IS NULL OR TRIM(`paidAt`) = '' OR TRIM(`paidAt`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`paidAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `paidAt`
  END
  WHERE `paidAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `projects` SET `startDate` = CASE
    WHEN `startDate` IS NULL OR TRIM(`startDate`) = '' OR TRIM(`startDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`startDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `startDate`
  END
  WHERE `startDate` IS NOT NULL;
--> statement-breakpoint
UPDATE `projects` SET `endDate` = CASE
    WHEN `endDate` IS NULL OR TRIM(`endDate`) = '' OR TRIM(`endDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`endDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`endDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`endDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`endDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `endDate`
  END
  WHERE `endDate` IS NOT NULL;
--> statement-breakpoint
UPDATE `tasks` SET `dueAt` = CASE
    WHEN `dueAt` IS NULL OR TRIM(`dueAt`) = '' OR TRIM(`dueAt`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`dueAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `dueAt`
  END
  WHERE `dueAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `vehicle_expenses` SET `spentAt` = CASE
    WHEN `spentAt` IS NULL OR TRIM(`spentAt`) = '' OR TRIM(`spentAt`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`spentAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`spentAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`spentAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`spentAt`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `spentAt`
  END
  WHERE `spentAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `vehicles` SET `purchaseDate` = CASE
    WHEN `purchaseDate` IS NULL OR TRIM(`purchaseDate`) = '' OR TRIM(`purchaseDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`purchaseDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`purchaseDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`purchaseDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`purchaseDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `purchaseDate`
  END
  WHERE `purchaseDate` IS NOT NULL;
--> statement-breakpoint
UPDATE `vehicles` SET `inServiceDate` = CASE
    WHEN `inServiceDate` IS NULL OR TRIM(`inServiceDate`) = '' OR TRIM(`inServiceDate`) = '—' THEN NULL
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`inServiceDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN DATE_FORMAT(STR_TO_DATE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`inServiceDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), '%d/%m/%Y'), '%Y-%m-%d')
    WHEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`inServiceDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`inServiceDate`), '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9')
    ELSE `inServiceDate`
  END
  WHERE `inServiceDate` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `accidents` MODIFY COLUMN `occurredAt` date;
--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `due` date;
--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `submittedAt` date;
--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `followUpAt` date;
--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `startDate` date;
--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `expiry` date;
--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `expiry` date;
--> statement-breakpoint
ALTER TABLE `drivers` MODIFY COLUMN `renewal` date;
--> statement-breakpoint
ALTER TABLE `employees` MODIFY COLUMN `hireDate` date;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `start` date;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `due` date;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `expectedReturn` date;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `warrantyUntil` date;
--> statement-breakpoint
ALTER TABLE `payable_payments` MODIFY COLUMN `paidAt` date;
--> statement-breakpoint
ALTER TABLE `payables` MODIFY COLUMN `issueDate` date;
--> statement-breakpoint
ALTER TABLE `payables` MODIFY COLUMN `dueDate` date;
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `paidAt` date;
--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `startDate` date;
--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `endDate` date;
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `dueAt` date;
--> statement-breakpoint
ALTER TABLE `vehicle_expenses` MODIFY COLUMN `spentAt` date;
--> statement-breakpoint
ALTER TABLE `vehicles` MODIFY COLUMN `purchaseDate` date;
--> statement-breakpoint
ALTER TABLE `vehicles` MODIFY COLUMN `inServiceDate` date;
