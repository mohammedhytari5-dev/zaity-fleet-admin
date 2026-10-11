-- Monetary columns: `int` -> `decimal(15,2)`, plus a numeric maintenance cost.
--
-- Why: whole-riyal integers cannot represent halalas, so VAT on an indivisible
-- amount, partial settlements and fractional unit prices were all unrepresentable
-- and had to be rounded. The live database was checked before this migration:
-- every monetary column held only integral values and the largest was 100,000,
-- so this widening conversion changes no stored number.
--
-- IMPORTANT - every `MODIFY COLUMN` below restates its DEFAULT.
-- MySQL replaces the *entire* column definition on MODIFY, so any attribute not
-- repeated is dropped. drizzle-kit emitted `MODIFY COLUMN amount decimal(15,2)
-- NOT NULL` without the `DEFAULT 0` these columns declare, which would have
-- silently removed the default from 18 columns while the schema snapshot still
-- recorded it - after which `generate` would report "no schema changes" and the
-- divergence would stay invisible. `server/migration-defaults.test.ts` now fails
-- if any MODIFY COLUMN drops a default the schema declares.
--
-- Quantity columns (stock balances, item counts) are deliberately untouched:
-- they count physical units, not money.

ALTER TABLE `accidents` MODIFY COLUMN `estimatedRepairCost` decimal(15,2);--> statement-breakpoint
ALTER TABLE `accidents` MODIFY COLUMN `settlementAmount` decimal(15,2);--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `amount` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `paid` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `total` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `collected` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `estimatedCost` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `quotedPartsCost` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `laborCost` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `partsCost` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `fundingAmount` decimal(15,2);--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `advanceInvoiceTotal` decimal(15,2);--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `advanceVariance` decimal(15,2);--> statement-breakpoint
ALTER TABLE `payable_payments` MODIFY COLUMN `amount` decimal(15,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `payables` MODIFY COLUMN `amount` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `payables` MODIFY COLUMN `paid` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `amount` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `purchase_quotes` MODIFY COLUMN `unitPrice` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `purchase_quotes` MODIFY COLUMN `taxAmount` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `purchase_quotes` MODIFY COLUMN `totalAmount` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `purchase_requests` MODIFY COLUMN `estimatedBudget` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` MODIFY COLUMN `amount` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicle_revenues` MODIFY COLUMN `amount` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicles` MODIFY COLUMN `purchasePrice` decimal(15,2) NOT NULL DEFAULT 0;--> statement-breakpoint

-- Numeric source of truth for the actual maintenance cost. The legacy `cost`
-- text column (values such as '0 ر.س', '1 SAR', '300 SAR') is kept only so
-- existing screens keep rendering; the application now reads `costAmount` and
-- falls back to parsing the text for rows written before this column existed.
ALTER TABLE `maintenance_requests` ADD `costAmount` decimal(15,2);
--> statement-breakpoint
-- Back-fill from the legacy text so SQL-level reporting can rely on the numeric
-- column immediately. REGEXP_REPLACE keeps this readable, unlike the sixteen
-- nested REPLACEs an earlier migration needed to read the same value.
UPDATE `maintenance_requests`
SET `costAmount` = CAST(REGEXP_REPLACE(`cost`, '[^0-9.]', '') AS DECIMAL(15,2))
WHERE `costAmount` IS NULL
  AND REGEXP_REPLACE(`cost`, '[^0-9.]', '') <> '';
