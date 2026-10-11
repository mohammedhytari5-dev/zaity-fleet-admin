-- Baseline migration.
--
-- Historically this file was intentionally empty, on the assumption that the
-- `users` table "already exists in databases created before migration history
-- was restored". That assumption only holds for the one long-lived database it
-- was written against: on a clean database `0013_local_auth_users.sql`
-- immediately runs `ALTER TABLE users ...` and fails with
-- "Table 'users' doesn't exist", taking every later foreign-key migration down
-- with it. Disaster recovery and staging environments could therefore not be
-- built from this repository at all.
--
-- The table is created here, guarded with IF NOT EXISTS so that existing
-- databases (which already have it) are unaffected. Later migrations add the
-- newer authentication columns (passwordHash, isActive, permissions, username).

CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
