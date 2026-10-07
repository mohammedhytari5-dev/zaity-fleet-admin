ALTER TABLE `payables` ADD `maintenanceRequestId` int;--> statement-breakpoint
CREATE INDEX `payables_maintenance_request_idx` ON `payables` (`maintenanceRequestId`);
