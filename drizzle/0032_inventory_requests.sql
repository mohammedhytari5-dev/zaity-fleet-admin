CREATE TABLE `inventory_request_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`itemId` int NOT NULL,
	`itemName` varchar(180) NOT NULL,
	`sku` varchar(64) NOT NULL,
	`unit` varchar(40) NOT NULL,
	`requestedQuantity` int NOT NULL,
	`approvedQuantity` int NOT NULL DEFAULT 0,
	`issuedQuantity` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_request_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(48) NOT NULL,
	`requestedByUserId` int,
	`requestedByName` varchar(160) NOT NULL,
	`purpose` varchar(500) NOT NULL,
	`status` enum('بانتظار الاعتماد','معتمد','مرفوض','مصروف') NOT NULL DEFAULT 'بانتظار الاعتماد',
	`approvalNotes` text,
	`approvedByUserId` int,
	`approvedByName` varchar(160),
	`approvedAt` timestamp,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_requests_ref_unique` UNIQUE(`ref`)
);
--> statement-breakpoint
CREATE INDEX `inventory_request_items_request_idx` ON `inventory_request_items` (`requestId`);--> statement-breakpoint
CREATE INDEX `inventory_request_items_item_idx` ON `inventory_request_items` (`itemId`);--> statement-breakpoint
CREATE INDEX `inventory_requests_status_created_idx` ON `inventory_requests` (`status`,`createdAt`);