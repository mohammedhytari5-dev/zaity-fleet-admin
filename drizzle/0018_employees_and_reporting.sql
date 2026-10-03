CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeNo` varchar(40) NOT NULL,
	`name` varchar(160) NOT NULL,
	`nationalId` varchar(64) NOT NULL DEFAULT '—',
	`phone` varchar(40) NOT NULL DEFAULT '—',
	`email` varchar(320) NOT NULL DEFAULT '—',
	`department` varchar(120) NOT NULL DEFAULT 'الإدارة',
	`jobTitle` varchar(120) NOT NULL DEFAULT 'موظف',
	`hireDate` varchar(32) NOT NULL DEFAULT '—',
	`status` enum('نشط','إجازة','موقوف','منتهي الخدمة') NOT NULL DEFAULT 'نشط',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_employeeNo_unique` UNIQUE(`employeeNo`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `entityType` varchar(40) DEFAULT 'مركبة' NOT NULL;--> statement-breakpoint
UPDATE `documents` AS d INNER JOIN `vehicles` AS v ON d.`entityId` = v.`id` AND d.`entity` = v.`plate` SET d.`entityType` = 'مركبة';--> statement-breakpoint
UPDATE `documents` AS d INNER JOIN `drivers` AS x ON d.`entityId` = x.`id` AND d.`entity` = x.`name` SET d.`entityType` = 'سائق';--> statement-breakpoint
UPDATE `documents` AS d INNER JOIN `projects` AS p ON d.`entityId` = p.`id` AND d.`entity` = p.`name` SET d.`entityType` = 'مشروع';--> statement-breakpoint
UPDATE `documents` AS d INNER JOIN `clients` AS c ON d.`entityId` = c.`id` AND d.`entity` = c.`name` SET d.`entityType` = 'عميل';--> statement-breakpoint
ALTER TABLE `projects` ADD `managerEmployeeId` int;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `employeeId` int;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `employee` varchar(160) DEFAULT '—' NOT NULL;