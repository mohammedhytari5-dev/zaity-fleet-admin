CREATE TABLE `vehicle_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleId` int NOT NULL,
	`maintenanceRequestId` int,
	`projectId` int,
	`projectName` varchar(200) NOT NULL DEFAULT '—',
	`clientId` int,
	`clientName` varchar(200) NOT NULL DEFAULT '—',
	`category` enum('صيانة','قطع غيار','زيوت وفلاتر','إطارات','إصلاحات وأعطال','تأمين','فحص واستمارة','مخالفات','أخرى') NOT NULL,
	`amount` int NOT NULL DEFAULT 0,
	`spentAt` varchar(32) NOT NULL,
	`description` varchar(300) NOT NULL,
	`vendor` varchar(160) NOT NULL DEFAULT '—',
	`receiptName` varchar(255),
	`receiptUrl` mediumtext,
	`notes` text,
	`createdByUserId` int,
	`createdByName` varchar(160) NOT NULL DEFAULT '—',
	`updatedByUserId` int,
	`updatedByName` varchar(160) NOT NULL DEFAULT '—',
	`archivedByUserId` int,
	`archivedByName` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `vehicle_expenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicle_expenses_maintenanceRequestId_unique` UNIQUE(`maintenanceRequestId`)
);
--> statement-breakpoint
CREATE TABLE `vehicle_revenues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleId` int NOT NULL,
	`paymentId` int NOT NULL,
	`projectId` int,
	`projectName` varchar(200) NOT NULL DEFAULT '—',
	`clientId` int,
	`clientName` varchar(200) NOT NULL DEFAULT '—',
	`amount` int NOT NULL DEFAULT 0,
	`receiptName` varchar(255),
	`receiptUrl` mediumtext,
	`notes` text,
	`createdByUserId` int,
	`createdByName` varchar(160) NOT NULL DEFAULT '—',
	`archivedByUserId` int,
	`archivedByName` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`archivedAt` timestamp,
	CONSTRAINT `vehicle_revenues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `receiptName` varchar(255);--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `receiptUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `purchasePrice` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `purchaseDate` varchar(32) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `inServiceDate` varchar(32) DEFAULT '—' NOT NULL;
--> statement-breakpoint
INSERT INTO `vehicle_expenses` (`vehicleId`, `maintenanceRequestId`, `projectId`, `projectName`, `clientId`, `clientName`, `category`, `amount`, `spentAt`, `description`, `vendor`, `receiptName`, `receiptUrl`, `createdByName`, `updatedByName`, `createdAt`, `updatedAt`)
SELECT `mr`.`vehicleId`, `mr`.`id`, `v`.`projectId`, COALESCE(`v`.`project`, '—'), `v`.`clientId`, COALESCE(`v`.`client`, '—'), 'صيانة', CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`mr`.`cost`, '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), 'ر.س', ''), 'ريال', ''), 'SAR', ''), ',', ''), '٬', ''), ' ', '') AS UNSIGNED), CASE WHEN `mr`.`start` IS NOT NULL AND `mr`.`start` <> '—' THEN `mr`.`start` ELSE DATE_FORMAT(`mr`.`createdAt`, '%Y-%m-%d') END, LEFT(CONCAT(`mr`.`type`, IF(`mr`.`reason` IS NULL OR `mr`.`reason` = '—', '', CONCAT(' · ', `mr`.`reason`))), 300), COALESCE(`mr`.`manager`, '—'), `mr`.`receiptName`, `mr`.`receiptUrl`, 'النظام (ترحيل)', 'النظام (ترحيل)', `mr`.`createdAt`, `mr`.`updatedAt`
FROM `maintenance_requests` AS `mr` INNER JOIN `vehicles` AS `v` ON `v`.`id` = `mr`.`vehicleId`
WHERE `mr`.`vehicleId` IS NOT NULL AND CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`mr`.`cost`, '٠', '0'), '١', '1'), '٢', '2'), '٣', '3'), '٤', '4'), '٥', '5'), '٦', '6'), '٧', '7'), '٨', '8'), '٩', '9'), 'ر.س', ''), 'ريال', ''), 'SAR', ''), ',', ''), '٬', ''), ' ', '') AS UNSIGNED) > 0;