CREATE TABLE `maintenance_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`maintenanceRequestId` int NOT NULL,
	`eventType` varchar(60) NOT NULL,
	`fromStage` varchar(80),
	`toStage` varchar(80),
	`details` text,
	`actorUserId` int,
	`actorName` varchar(160) NOT NULL DEFAULT '—',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenance_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `priority` enum('طارئ','عاجل','متوسط','عادي') DEFAULT 'متوسط' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `workflowStage` enum('بلاغ','فحص','تشخيص','تقدير تكلفة','اعتماد','تنفيذ','فحص بعد الإصلاح','مغلق','مرفوض') DEFAULT 'بلاغ' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `reportedBy` varchar(160) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `diagnosis` text;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `technician` varchar(160) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `workshop` varchar(200) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `estimatedCost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `laborCost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `partsCost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `approvalStatus` enum('غير مطلوب','بانتظار الاعتماد','معتمد','مرفوض') DEFAULT 'غير مطلوب' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `approvedByUserId` int;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `approvedByName` varchar(160);--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `approvalNotes` text;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `warrantyUntil` varchar(32) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `closedAt` timestamp;
--> statement-breakpoint
UPDATE `maintenance_requests`
SET `workflowStage` = CASE
	WHEN `status` = 'مكتمل' THEN 'مغلق'
	WHEN `status` = 'جاري العمل' THEN 'تنفيذ'
	WHEN `status` = 'بانتظار الفحص' THEN 'فحص بعد الإصلاح'
	ELSE 'بلاغ'
END;
