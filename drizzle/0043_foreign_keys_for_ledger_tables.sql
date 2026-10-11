-- Foreign keys for the operational and financial tables.
--
-- Audited against the live database: 24 of 32 tables had no referential
-- integrity at all, including every table that carries money. Their identifiers
-- were plain integers, so a deleted project, client, vehicle or user could leave
-- rows pointing at records that no longer exist, and the vehicle financial
-- profile (which joins by id) would silently produce blank or wrong figures.
--
-- Before this migration was written, every candidate key was checked for orphan
-- rows with a LEFT JOIN against its parent: all 31 candidates returned zero
-- orphans, so no data cleanup was required.
--
-- Delete semantics are deliberate, not uniform:
--   * SET NULL  - nullable historical references. Archiving/deleting the parent
--                 must not destroy the financial record, and the readable name
--                 column (e.g. `vehicle.client`) preserves the original label.
--   * CASCADE   - owned children that are meaningless without the parent:
--                 contract items, maintenance timeline events, client
--                 representatives.
--   * RESTRICT  - ledger rows that must never disappear silently:
--                 payable payments, vehicle expenses, vehicle revenue
--                 allocations. Deleting a referenced parent now fails loudly
--                 instead of orphaning money.
--
-- Two keys use explicit short names because the name drizzle would derive
-- exceeds MySQL's 64-character identifier limit:
--   maintenance_events_request_fk              (derived would be 66)
--   vehicle_expenses_maintenance_request_fk    (derived would be exactly 64)

ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claims` ADD CONSTRAINT `claims_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claims` ADD CONSTRAINT `claims_contractId_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_representatives` ADD CONSTRAINT `client_representatives_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contract_items` ADD CONSTRAINT `contract_items_contractId_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contract_items` ADD CONSTRAINT `contract_items_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drivers` ADD CONSTRAINT `drivers_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_events` ADD CONSTRAINT `maintenance_events_request_fk` FOREIGN KEY (`maintenanceRequestId`) REFERENCES `maintenance_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_approvedByUserId_users_id_fk` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_fundingIssuedByUserId_users_id_fk` FOREIGN KEY (`fundingIssuedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payable_payments` ADD CONSTRAINT `payable_payments_payableId_payables_id_fk` FOREIGN KEY (`payableId`) REFERENCES `payables`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payables` ADD CONSTRAINT `payables_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payables` ADD CONSTRAINT `payables_maintenanceRequestId_maintenance_requests_id_fk` FOREIGN KEY (`maintenanceRequestId`) REFERENCES `maintenance_requests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_contractId_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_claimId_claims_id_fk` FOREIGN KEY (`claimId`) REFERENCES `claims`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_contractId_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `purchase_requests_selectedQuoteId_purchase_quotes_id_fk` FOREIGN KEY (`selectedQuoteId`) REFERENCES `purchase_quotes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_payableId_payables_id_fk` FOREIGN KEY (`payableId`) REFERENCES `payables`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_maintenance_request_fk` FOREIGN KEY (`maintenanceRequestId`) REFERENCES `maintenance_requests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_revenues` ADD CONSTRAINT `vehicle_revenues_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_revenues` ADD CONSTRAINT `vehicle_revenues_paymentId_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_revenues` ADD CONSTRAINT `vehicle_revenues_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_revenues` ADD CONSTRAINT `vehicle_revenues_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_driverId_drivers_id_fk` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_employeeId_employees_id_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_contractId_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE set null ON UPDATE no action;
