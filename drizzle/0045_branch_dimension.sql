-- Branch dimension: one legal entity operating several branches.
--
-- Every operational table gains the branch it belongs to. Adding this before
-- the accounting and e-invoicing modules is deliberate: every journal entry,
-- tax invoice and report must be attributable to a branch, and retrofitting
-- the dimension afterwards would mean redesigning all of them.
--
-- ORDERING IS LOAD-BEARING: the main branch row is inserted immediately after
-- the table is created. Existing rows take `branchId` from the column default
-- (1), so adding the foreign keys before that row exists would fail with
-- ER_NO_REFERENCED_ROW_2.
--
-- `DEFAULT 1` is a transition measure only: it keeps in-flight inserts working
-- until the data layer threads the acting branch explicitly. Once it does, the
-- default is to be dropped so no row can be silently attributed to the main
-- branch.

CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`address` varchar(300) NOT NULL DEFAULT '—',
	`phone` varchar(40) NOT NULL DEFAULT '—',
	`vatNumber` varchar(64) NOT NULL DEFAULT '—',
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branches_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
INSERT INTO `branches` (`id`, `code`, `name`) VALUES (1, 'MAIN', 'الفرع الرئيسي');
--> statement-breakpoint
ALTER TABLE `accidents` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `claims` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `drivers` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_requests` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `payable_payments` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `payables` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_quotes` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicle_revenues` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `branches_archived_created_idx` ON `branches` (`archivedAt`,`createdAt`);--> statement-breakpoint
ALTER TABLE `accidents` ADD CONSTRAINT `accidents_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claims` ADD CONSTRAINT `claims_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drivers` ADD CONSTRAINT `drivers_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_requests` ADD CONSTRAINT `inventory_requests_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payable_payments` ADD CONSTRAINT `payable_payments_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payables` ADD CONSTRAINT `payables_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_quotes` ADD CONSTRAINT `purchase_quotes_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `purchase_requests_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_revenues` ADD CONSTRAINT `vehicle_revenues_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accidents_branch_archived_idx` ON `accidents` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `claims_branch_archived_idx` ON `claims` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `contracts_branch_archived_idx` ON `contracts` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `documents_branch_archived_idx` ON `documents` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `drivers_branch_archived_idx` ON `drivers` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `employees_branch_archived_idx` ON `employees` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `inventory_items_branch_archived_idx` ON `inventory_items` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `inventory_movements_branch_created_idx` ON `inventory_movements` (`branchId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `inventory_requests_branch_created_idx` ON `inventory_requests` (`branchId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maintenance_requests_branch_archived_idx` ON `maintenance_requests` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `payable_payments_branch_created_idx` ON `payable_payments` (`branchId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `payables_branch_archived_idx` ON `payables` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `payments_branch_archived_idx` ON `payments` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `projects_branch_archived_idx` ON `projects` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `purchase_quotes_branch_created_idx` ON `purchase_quotes` (`branchId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `purchase_requests_branch_archived_idx` ON `purchase_requests` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `tasks_branch_archived_idx` ON `tasks` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `vehicle_expenses_branch_archived_idx` ON `vehicle_expenses` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `vehicle_revenues_branch_archived_idx` ON `vehicle_revenues` (`branchId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `vehicles_branch_archived_idx` ON `vehicles` (`branchId`,`archivedAt`);