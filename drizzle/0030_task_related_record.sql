ALTER TABLE `tasks` ADD `relatedEntityType` varchar(40);--> statement-breakpoint
ALTER TABLE `tasks` ADD `relatedEntityId` int;--> statement-breakpoint
CREATE INDEX `tasks_related_entity_idx` ON `tasks` (`relatedEntityType`,`relatedEntityId`);