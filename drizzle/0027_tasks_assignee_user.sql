ALTER TABLE `tasks` ADD `assigneeUserId` int;--> statement-breakpoint
UPDATE `tasks` AS t SET `assigneeUserId` = (SELECT MIN(u.`id`) FROM `users` AS u WHERE u.`isActive` = 1 AND u.`name` IS NOT NULL AND LOWER(TRIM(u.`name`)) = LOWER(TRIM(t.`assignee`))) WHERE t.`assigneeUserId` IS NULL AND TRIM(t.`assignee`) <> '—';--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigneeUserId_users_id_fk` FOREIGN KEY (`assigneeUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
