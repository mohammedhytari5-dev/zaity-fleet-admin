CREATE TABLE IF NOT EXISTS `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int,
	`employeeName` varchar(160) NOT NULL,
	`employeeCode` varchar(60) NOT NULL DEFAULT '—',
	`date` varchar(32) NOT NULL,
	`checkIn` varchar(32),
	`checkOut` varchar(32),
	`workHours` decimal(6,2) DEFAULT '0.00',
	`delayMinutes` int DEFAULT 0,
	`overtimeHours` decimal(6,2) DEFAULT '0.00',
	`status` enum('حاضر','تأخير','غياب','إجازة','استئذان','عطلة') NOT NULL DEFAULT 'حاضر',
	`source` enum('جهاز بصمة','يدوي','تطبيق','ملف') NOT NULL DEFAULT 'جهاز بصمة',
	`deviceIp` varchar(64),
	`deviceName` varchar(120),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `biometric_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`ip` varchar(64) NOT NULL,
	`port` int NOT NULL DEFAULT 4370,
	`commKey` varchar(64) DEFAULT '0',
	`location` varchar(160) DEFAULT '—',
	`model` varchar(100) DEFAULT 'ZKTeco Standalone',
	`status` enum('متصل','غير متصل','جاري المزامنة') NOT NULL DEFAULT 'متصل',
	`lastSyncAt` timestamp,
	`autoSync` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `biometric_devices_id` PRIMARY KEY(`id`)
);
