CREATE TABLE IF NOT EXISTS `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL DEFAULT 1,
	`code` varchar(40) NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'قطع غيار',
	`contactPerson` varchar(160),
	`phone` varchar(64),
	`email` varchar(120),
	`vatNumber` varchar(64),
	`crNumber` varchar(64),
	`address` varchar(255),
	`paymentTerms` varchar(64) NOT NULL DEFAULT 'آجل 30 يوم',
	`bankName` varchar(120),
	`iban` varchar(64),
	`rating` int NOT NULL DEFAULT 5,
	`status` enum('نشط','موقوف') NOT NULL DEFAULT 'نشط',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `payables` ADD `supplierId` int;
--> statement-breakpoint
ALTER TABLE `purchase_quotes` ADD `supplierId` int;
--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `supplierId` int;
