ALTER TABLE `employees` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;