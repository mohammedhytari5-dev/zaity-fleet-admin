CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`location` varchar(120) NOT NULL DEFAULT '—',
	`vat` varchar(80) NOT NULL DEFAULT '—',
	`commercial` varchar(80) NOT NULL DEFAULT '—',
	`contact` varchar(160) NOT NULL DEFAULT '—',
	`phone` varchar(40) NOT NULL DEFAULT '—',
	`contracts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
