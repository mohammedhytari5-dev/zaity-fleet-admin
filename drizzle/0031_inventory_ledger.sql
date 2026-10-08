CREATE TABLE `inventory_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` varchar(100) NOT NULL,
	`unit` varchar(40) NOT NULL DEFAULT 'قطعة',
	`onHand` int NOT NULL DEFAULT 0,
	`reorderLevel` int NOT NULL DEFAULT 0,
	`location` varchar(160) NOT NULL DEFAULT '—',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `inventory_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_items_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`direction` enum('استلام','صرف') NOT NULL,
	`quantity` int NOT NULL,
	`resultingBalance` int NOT NULL,
	`reference` varchar(120) NOT NULL DEFAULT '—',
	`recipient` varchar(160) NOT NULL DEFAULT '—',
	`notes` text,
	`actorUserId` int,
	`actorName` varchar(160) NOT NULL DEFAULT '—',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `inventory_movements_item_created_idx` ON `inventory_movements` (`itemId`,`createdAt`);