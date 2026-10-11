-- `entityId` is declared here because later migrations depend on it:
-- `0018_employees_and_reporting.sql` back-fills `entityType` with
-- `UPDATE documents ... ON d.entityId = v.id`, but no migration ever created
-- the column. On a clean database that UPDATE failed with "Unknown column
-- 'd.entityId'". Existing databases already have the column, so the
-- IF NOT EXISTS guard keeps this migration a no-op for them.
CREATE TABLE IF NOT EXISTS `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`entity` varchar(160) NOT NULL DEFAULT '—',
	`entityId` int,
	`type` varchar(80) NOT NULL DEFAULT 'مركبة',
	`expiry` varchar(32) NOT NULL DEFAULT '—',
	`status` enum('ساري','قريبًا','متأخر','منتهي') NOT NULL DEFAULT 'ساري',
	`owner` varchar(160) NOT NULL DEFAULT '—',
	`fileName` varchar(255),
	`fileUrl` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
