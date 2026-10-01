CREATE TABLE `contract_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`vehicleId` int,
	`vehiclePlate` varchar(32) NOT NULL DEFAULT '—',
	`quantity` int NOT NULL DEFAULT 1,
	`driver` varchar(120) NOT NULL DEFAULT '—',
	`coverage` enum('مركبة وسائق','سائق فقط','مركبة فقط') NOT NULL DEFAULT 'مركبة وسائق',
	`description` varchar(240) NOT NULL DEFAULT 'خدمة تشغيل',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(40) NOT NULL,
	`client` varchar(160) NOT NULL,
	`type` varchar(120) NOT NULL,
	`startDate` varchar(32) NOT NULL,
	`expiry` varchar(32) NOT NULL,
	`total` int NOT NULL DEFAULT 0,
	`collected` int NOT NULL DEFAULT 0,
	`status` enum('قائم','مكتمل','عرض سعر','ملغي') NOT NULL DEFAULT 'قائم',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contracts_ref_unique` UNIQUE(`ref`)
);
