CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(40) NOT NULL,
	`name` varchar(200) NOT NULL,
	`clientId` int,
	`client` varchar(200) NOT NULL DEFAULT '—',
	`contractId` int,
	`contract` varchar(40) NOT NULL DEFAULT '—',
	`manager` varchar(160) NOT NULL DEFAULT '—',
	`startDate` varchar(32) NOT NULL DEFAULT '—',
	`endDate` varchar(32) NOT NULL DEFAULT '—',
	`requiredVehicles` int NOT NULL DEFAULT 0,
	`status` enum('مخطط','نشط','موقوف','مكتمل','ملغي') NOT NULL DEFAULT 'مخطط',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_ref_unique` UNIQUE(`ref`)
);
--> statement-breakpoint
ALTER TABLE `vehicles` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `project` varchar(200) DEFAULT '—' NOT NULL;