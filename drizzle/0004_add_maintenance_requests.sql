CREATE TABLE `maintenance_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(40) NOT NULL,
	`vehicle` varchar(80) NOT NULL,
	`type` varchar(160) NOT NULL,
	`manager` varchar(160) NOT NULL DEFAULT '—',
	`start` varchar(32) NOT NULL DEFAULT '—',
	`due` varchar(32) NOT NULL DEFAULT '—',
	`status` enum('جديد','جاري العمل','مكتمل','متوقف') NOT NULL DEFAULT 'جديد',
	`cost` varchar(40) NOT NULL DEFAULT '0 ر.س',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `maintenance_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `maintenance_requests_ref_unique` UNIQUE(`ref`)
);
