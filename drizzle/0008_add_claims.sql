CREATE TABLE `claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(40) NOT NULL,
	`client` varchar(160) NOT NULL,
	`clientId` int,
	`contract` varchar(40) NOT NULL,
	`contractId` int,
	`amount` int NOT NULL DEFAULT 0,
	`due` varchar(32) NOT NULL DEFAULT '—',
	`paid` int NOT NULL DEFAULT 0,
	`status` enum('مستحقة','مدفوعة','متأخرة','ملغاة') NOT NULL DEFAULT 'مستحقة',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `claims_ref_unique` UNIQUE(`ref`)
);
