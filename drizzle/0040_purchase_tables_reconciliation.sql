-- Reconciliation migration for the procurement tables (purchase_requests,
-- purchase_quotes).
--
-- History: these two tables were never part of the migration chain. They were
-- created by raw DDL inside `ensureAuthSchema` (server/db.ts) on first database
-- access, with `CREATE TABLE IF NOT EXISTS` and every error swallowed. That had
-- three consequences this migration fixes:
--
--   1. A database provisioned from `drizzle/*.sql` alone never had these
--      tables at all, so the procurement module failed at runtime.
--   2. `IF NOT EXISTS` meant later column additions in drizzle/schema.ts could
--      never reach an existing database - the definition silently drifted.
--   3. The runtime DDL declared no foreign keys and no indexes, so the live
--      database lost the referential integrity that schema.ts declares.
--
-- The `IF NOT EXISTS` guards below make this migration safe on both kinds of
-- database:
--   * an existing database already has the tables (creation is skipped) but is
--     missing the FKs and indexes, which the statements below add;
--   * a fresh database has neither, so the tables are created and then the same
--     statements add the FKs and indexes.
--
-- Known cosmetic drift: on databases created by the old runtime DDL the unique
-- constraint on `purchase_requests.ref` is named `ref` (MySQL's default) rather
-- than `purchase_requests_ref_unique`. The constraint behaves identically.

CREATE TABLE IF NOT EXISTS `purchase_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`supplierName` varchar(200) NOT NULL,
	`supplierVat` varchar(64),
	`supplierPhone` varchar(64),
	`itemDescription` varchar(300) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` int NOT NULL DEFAULT 0,
	`taxAmount` int NOT NULL DEFAULT 0,
	`totalAmount` int NOT NULL DEFAULT 0,
	`deliveryDays` int NOT NULL DEFAULT 3,
	`warrantyPeriod` varchar(100) NOT NULL DEFAULT 'لا يوجد',
	`supplierRating` int NOT NULL DEFAULT 4,
	`quoteFileUrl` mediumtext,
	`quoteFileName` varchar(255),
	`notes` text,
	`isSelected` int NOT NULL DEFAULT 0,
	`selectionReason` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `purchase_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(48) NOT NULL,
	`department` varchar(100) NOT NULL DEFAULT 'الصيانة',
	`category` varchar(100) NOT NULL DEFAULT 'قطع غيار',
	`purpose` varchar(500) NOT NULL,
	`priority` enum('عادي','متوسط','عاجل','طارئ') NOT NULL DEFAULT 'عادي',
	`estimatedBudget` int NOT NULL DEFAULT 0,
	`status` enum('جديد','بانتظار العروض','قيد المقارنة','معتمد','أمر شراء صادر','مرفوض','مكتمل') NOT NULL DEFAULT 'جديد',
	`requestedByUserId` int,
	`requestedByName` varchar(160) NOT NULL,
	`selectedQuoteId` int,
	`approvalNotes` text,
	`approvedByUserId` int,
	`approvedByName` varchar(160),
	`approvedAt` timestamp,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `purchase_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_requests_ref_unique` UNIQUE(`ref`)
);
--> statement-breakpoint
ALTER TABLE `purchase_quotes` ADD CONSTRAINT `purchase_quotes_requestId_purchase_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `purchase_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `purchase_requests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `purchase_requests_approvedByUserId_users_id_fk` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `purchase_quotes_request_idx` ON `purchase_quotes` (`requestId`);--> statement-breakpoint
CREATE INDEX `purchase_requests_status_idx` ON `purchase_requests` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `purchase_requests_dept_idx` ON `purchase_requests` (`department`,`createdAt`);
