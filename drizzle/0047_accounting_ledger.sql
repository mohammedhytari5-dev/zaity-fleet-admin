-- Accounting Core & General Ledger (النواة المحاسبية ودفتر الأستاذ العام)
--
-- Adds double-entry bookkeeping foundation:
--   1. `accounts` (Chart of Accounts / شجرة الحسابات)
--   2. `fiscal_periods` (Financial Periods / الفترات المالية)
--   3. `journal_entries` (General Journal Entries / قيود اليومية العامة)
--   4. `journal_lines` (Entry Lines & Cost Centers / أسطر القيود ومراكز التكلفة)

CREATE TABLE IF NOT EXISTS `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(200) NOT NULL,
	`type` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`normalBalance` enum('debit','credit') NOT NULL,
	`parentId` int,
	`level` int NOT NULL DEFAULT 1,
	`isActive` int NOT NULL DEFAULT 1,
	`branchId` int,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fiscal_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`closedAt` timestamp,
	`closedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`archivedAt` timestamp,
	CONSTRAINT `fiscal_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryNumber` varchar(64) NOT NULL,
	`entryDate` date NOT NULL,
	`description` text NOT NULL,
	`reference` varchar(120) NOT NULL DEFAULT '—',
	`sourceType` varchar(40) NOT NULL DEFAULT 'manual',
	`sourceId` int,
	`status` enum('draft','posted','reversed') NOT NULL DEFAULT 'posted',
	`isReversed` int NOT NULL DEFAULT 0,
	`reversedEntryId` int,
	`branchId` int NOT NULL DEFAULT 1,
	`fiscalPeriodId` int,
	`totalDebit` decimal(15,2) NOT NULL DEFAULT '0.00',
	`totalCredit` decimal(15,2) NOT NULL DEFAULT '0.00',
	`createdBy` int,
	`postedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_entries_entryNumber_unique` UNIQUE(`entryNumber`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `journal_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryId` int NOT NULL,
	`accountId` int NOT NULL,
	`debit` decimal(15,2) NOT NULL DEFAULT '0.00',
	`credit` decimal(15,2) NOT NULL DEFAULT '0.00',
	`description` varchar(300),
	`branchId` int NOT NULL DEFAULT 1,
	`vehicleId` int,
	`projectId` int,
	`contractId` int,
	`driverId` int,
	`clientId` int,
	`lineOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `accounts_code_idx` ON `accounts` (`code`);--> statement-breakpoint
CREATE INDEX `accounts_parent_idx` ON `accounts` (`parentId`);--> statement-breakpoint
CREATE INDEX `accounts_type_idx` ON `accounts` (`type`);--> statement-breakpoint
CREATE INDEX `accounts_branch_idx` ON `accounts` (`branchId`);--> statement-breakpoint
CREATE INDEX `accounts_archived_idx` ON `accounts` (`archivedAt`);--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_parentId_accounts_id_fk` FOREIGN KEY (`parentId`) REFERENCES `accounts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fiscal_periods_dates_idx` ON `fiscal_periods` (`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX `fiscal_periods_status_idx` ON `fiscal_periods` (`status`);--> statement-breakpoint
ALTER TABLE `fiscal_periods` ADD CONSTRAINT `fiscal_periods_closedBy_users_id_fk` FOREIGN KEY (`closedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `journal_entries_date_branch_idx` ON `journal_entries` (`entryDate`,`branchId`);--> statement-breakpoint
CREATE INDEX `journal_entries_status_idx` ON `journal_entries` (`status`);--> statement-breakpoint
CREATE INDEX `journal_entries_source_idx` ON `journal_entries` (`sourceType`,`sourceId`);--> statement-breakpoint
CREATE INDEX `journal_entries_period_idx` ON `journal_entries` (`fiscalPeriodId`);--> statement-breakpoint
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_fiscalPeriodId_fiscal_periods_id_fk` FOREIGN KEY (`fiscalPeriodId`) REFERENCES `fiscal_periods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_reversed_fk` FOREIGN KEY (`reversedEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `journal_lines_entry_idx` ON `journal_lines` (`entryId`);--> statement-breakpoint
CREATE INDEX `journal_lines_account_idx` ON `journal_lines` (`accountId`);--> statement-breakpoint
CREATE INDEX `journal_lines_vehicle_idx` ON `journal_lines` (`vehicleId`);--> statement-breakpoint
CREATE INDEX `journal_lines_project_idx` ON `journal_lines` (`projectId`);--> statement-breakpoint
CREATE INDEX `journal_lines_contract_idx` ON `journal_lines` (`contractId`);--> statement-breakpoint
CREATE INDEX `journal_lines_branch_idx` ON `journal_lines` (`branchId`);--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_entryId_journal_entries_id_fk` FOREIGN KEY (`entryId`) REFERENCES `journal_entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_contractId_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_driverId_drivers_id_fk` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;
