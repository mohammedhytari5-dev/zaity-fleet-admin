-- Link an inventory issue request to the maintenance request that consumes it.
--
-- NOTE: this migration previously could never be applied. Drizzle derived the
-- foreign key name `inventory_requests_maintenanceRequestId_maintenance_requests_id_fk`
-- (66 characters), which exceeds MySQL's 64-character identifier limit, so
-- `db:migrate` aborted with ER_TOO_LONG_IDENT and every later migration was
-- blocked with it. schema.ts now declares an explicit 41-character name
-- (`inventory_requests_maintenance_request_fk`) so the generated SQL is valid.
--
-- The column is added first, then the constraint and index, matching the order
-- Drizzle emits and keeping the table readable in SHOW CREATE TABLE output.

ALTER TABLE `inventory_requests` ADD `maintenanceRequestId` int;
--> statement-breakpoint
ALTER TABLE `inventory_requests` ADD CONSTRAINT `inventory_requests_maintenance_request_fk` FOREIGN KEY (`maintenanceRequestId`) REFERENCES `maintenance_requests`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `inventory_requests_maintenance_idx` ON `inventory_requests` (`maintenanceRequestId`, `createdAt`);
