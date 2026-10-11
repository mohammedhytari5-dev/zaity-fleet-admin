CREATE TABLE IF NOT EXISTS `payroll` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(160) NOT NULL,
	`month` varchar(20) NOT NULL,
	`basicSalary` int NOT NULL DEFAULT 0,
	`allowances` int NOT NULL DEFAULT 0,
	`deductions` int NOT NULL DEFAULT 0,
	`netSalary` int NOT NULL DEFAULT 0,
	`status` enum('مسودة','معتمد','تم الصرف') NOT NULL DEFAULT 'مسودة',
	`paidAt` varchar(32),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `leaves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(160) NOT NULL,
	`type` enum('سنوية','مرضية','طارئة','بدون راتب') NOT NULL DEFAULT 'سنوية',
	`startDate` varchar(32) NOT NULL,
	`endDate` varchar(32) NOT NULL,
	`days` int NOT NULL DEFAULT 1,
	`reason` varchar(255) DEFAULT '—',
	`status` enum('قيد المراجعة','معتمدة','مرفوضة') NOT NULL DEFAULT 'قيد المراجعة',
	`approvedBy` varchar(160),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaves_id` PRIMARY KEY(`id`)
);
