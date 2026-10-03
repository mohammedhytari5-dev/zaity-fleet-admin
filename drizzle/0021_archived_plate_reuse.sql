ALTER TABLE `vehicles` DROP INDEX `vehicles_plate_unique`;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `activePlate` varchar(32) GENERATED ALWAYS AS (CASE WHEN archivedAt IS NULL THEN plate ELSE NULL END) STORED;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_active_plate_unique` UNIQUE(`activePlate`);