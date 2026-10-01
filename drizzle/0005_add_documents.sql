CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`entity` varchar(160) NOT NULL DEFAULT '—',
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
