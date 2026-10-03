CREATE TABLE `payable_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payableId` int NOT NULL,
	`amount` int NOT NULL,
	`paidAt` varchar(32) NOT NULL,
	`method` varchar(80) NOT NULL DEFAULT 'تحويل بنكي',
	`reference` varchar(80) NOT NULL DEFAULT '—',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payable_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(40) NOT NULL,
	`supplier` varchar(200) NOT NULL,
	`description` varchar(300) NOT NULL,
	`amount` int NOT NULL DEFAULT 0,
	`paid` int NOT NULL DEFAULT 0,
	`issueDate` varchar(32) NOT NULL DEFAULT '—',
	`dueDate` varchar(32) NOT NULL DEFAULT '—',
	`status` enum('جديدة','معتمدة','مدفوعة جزئيًا','مدفوعة','ملغاة') NOT NULL DEFAULT 'جديدة',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `payables_id` PRIMARY KEY(`id`),
	CONSTRAINT `payables_ref_unique` UNIQUE(`ref`)
);
--> statement-breakpoint
ALTER TABLE `maintenance_requests` MODIFY COLUMN `status` enum('جديد','جاري العمل','بانتظار الفحص','مكتمل','متوقف') NOT NULL DEFAULT 'جديد';--> statement-breakpoint
ALTER TABLE `vehicles` MODIFY COLUMN `status` enum('متاحة','مؤجرة','مشغولة','في الصيانة','قيد التجهيز','متوقفة') NOT NULL DEFAULT 'متاحة';--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `reason` varchar(500) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `workDone` text;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `parts` text;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `expectedReturn` varchar(32) DEFAULT '—' NOT NULL;