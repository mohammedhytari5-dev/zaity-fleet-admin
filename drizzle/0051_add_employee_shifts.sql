ALTER TABLE `employees` ADD COLUMN `shiftName` varchar(80) NOT NULL DEFAULT 'الدوام الافتراضي (08:00 - 17:00)';
--> statement-breakpoint
ALTER TABLE `employees` ADD COLUMN `shiftStart` varchar(16) NOT NULL DEFAULT '08:00';
--> statement-breakpoint
ALTER TABLE `employees` ADD COLUMN `shiftEnd` varchar(16) NOT NULL DEFAULT '17:00';
--> statement-breakpoint
ALTER TABLE `employees` ADD COLUMN `gracePeriodMinutes` int NOT NULL DEFAULT 15;
--> statement-breakpoint
ALTER TABLE `attendance` ADD COLUMN `shiftName` varchar(80);
--> statement-breakpoint
ALTER TABLE `attendance` ADD COLUMN `shiftStart` varchar(16);
--> statement-breakpoint
ALTER TABLE `attendance` ADD COLUMN `shiftEnd` varchar(16);
--> statement-breakpoint
ALTER TABLE `attendance` ADD COLUMN `earlyExitMinutes` int DEFAULT 0;
