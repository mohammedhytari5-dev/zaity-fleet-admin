CREATE TABLE `accident_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accidentId` int NOT NULL,
	`fromStage` varchar(60),
	`toStage` varchar(60) NOT NULL,
	`details` text,
	`actorUserId` int,
	`actorName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accident_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `accidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(48) NOT NULL,
	`vehicleId` int,
	`vehiclePlate` varchar(32) NOT NULL,
	`driverId` int,
	`driverName` varchar(160) NOT NULL DEFAULT '—',
	`occurredAt` varchar(40) NOT NULL,
	`location` varchar(240) NOT NULL DEFAULT '—',
	`description` text NOT NULL,
	`najmReportNo` varchar(120) NOT NULL DEFAULT '—',
	`najmReportName` varchar(255),
	`najmReportUrl` mediumtext,
	`workflowStage` enum('بلاغ','تحديد المسؤولية','تقدير الإصلاح','مطالبة التأمين','التسوية','مغلق','ملغي') NOT NULL DEFAULT 'بلاغ',
	`faultPercent` int,
	`estimatedRepairCost` int,
	`insurerName` varchar(180),
	`insurerClaimRef` varchar(120),
	`insurerClaimStatus` enum('غير مرفوعة','مرفوعة','مقبولة','مرفوضة','مصروفة') NOT NULL DEFAULT 'غير مرفوعة',
	`settlementAmount` int,
	`resolutionNotes` text,
	`reportedByUserId` int,
	`reportedByName` varchar(160) NOT NULL,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `accidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `accidents_ref_unique` UNIQUE(`ref`),
	CONSTRAINT `accidents_najm_report_unique` UNIQUE(`najmReportNo`)
);
--> statement-breakpoint
ALTER TABLE `accident_events` ADD CONSTRAINT `accident_events_accidentId_accidents_id_fk` FOREIGN KEY (`accidentId`) REFERENCES `accidents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accident_events` ADD CONSTRAINT `accident_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accidents` ADD CONSTRAINT `accidents_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accidents` ADD CONSTRAINT `accidents_driverId_drivers_id_fk` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accidents` ADD CONSTRAINT `accidents_reportedByUserId_users_id_fk` FOREIGN KEY (`reportedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accident_events_accident_created_idx` ON `accident_events` (`accidentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `accidents_vehicle_occurred_idx` ON `accidents` (`vehicleId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `accidents_stage_created_idx` ON `accidents` (`workflowStage`,`createdAt`);