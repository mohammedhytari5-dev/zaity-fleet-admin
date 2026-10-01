CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plate` varchar(32) NOT NULL,
	`brand` varchar(80) NOT NULL,
	`model` varchar(120) NOT NULL,
	`year` varchar(8) NOT NULL,
	`color` varchar(48) NOT NULL,
	`mileage` varchar(32) NOT NULL,
	`driver` varchar(120) NOT NULL DEFAULT '—',
	`status` enum('متاحة','مؤجرة','مشغولة','في الصيانة','قيد التجهيز') NOT NULL DEFAULT 'متاحة',
	`client` varchar(160) NOT NULL DEFAULT '—',
	`contract` varchar(80) NOT NULL DEFAULT '—',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_plate_unique` UNIQUE(`plate`)
);
