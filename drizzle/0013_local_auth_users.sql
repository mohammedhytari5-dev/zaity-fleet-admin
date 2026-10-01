ALTER TABLE `users` ADD COLUMN `passwordHash` text NULL;
ALTER TABLE `users` ADD COLUMN `isActive` int NOT NULL DEFAULT 1;
ALTER TABLE `users` ADD COLUMN `permissions` text NULL;
