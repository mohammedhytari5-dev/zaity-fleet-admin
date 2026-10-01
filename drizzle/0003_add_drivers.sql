CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(40) NOT NULL DEFAULT '—',
	`idNo` varchar(64) NOT NULL DEFAULT '—',
	`status` enum('متاح','مشغول','موقوف') NOT NULL DEFAULT 'متاح',
	`vehicle` varchar(32) NOT NULL DEFAULT '—',
	`license` varchar(80) NOT NULL DEFAULT 'خصوصي',
	`renewal` varchar(32) NOT NULL DEFAULT '—',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`)
);
