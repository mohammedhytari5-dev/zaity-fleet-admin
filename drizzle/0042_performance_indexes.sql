-- Performance indexes for the operational and financial tables.
--
-- Audited against the live database: `contracts`, `contract_items`, `claims`,
-- `documents`, `maintenance_requests`, `maintenance_events`, `audit_logs`,
-- `payables`, `payable_payments`, `payments`, `projects`, `vehicles`, `drivers`,
-- `employees`, `clients`, `tasks` and `notifications` were missing the indexes
-- their own read paths need. Several had no secondary index at all
-- (`contract_items`, `documents`, `audit_logs`, `maintenance_requests`), so the
-- dashboard, the vehicle financial profile and the report period queries all
-- performed full table scans with a filesort.
--
-- Every statement here is an additive CREATE INDEX: no column, row or
-- constraint is modified, so this migration is safe on live data.
--
-- Index design notes:
--   * `(archivedAt, createdAt)` serves the common "active rows, newest first"
--     list pattern used by nearly every module.
--   * Composite indexes lead with the equality column and end with the sort
--     column, so MySQL can use them for both the filter and the ORDER BY.
--   * Where a wider index already covers a narrower one, only the wider index is
--     declared (e.g. `contracts_client_archived_created_idx` covers clientId).
--   * All names stay within MySQL's 64-character identifier limit; the
--     migration-integrity test enforces that.

CREATE INDEX `accidents_archived_occurred_idx` ON `accidents` (`archivedAt`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `claims_contract_archived_idx` ON `claims` (`contractId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `claims_client_archived_idx` ON `claims` (`clientId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `claims_archived_created_idx` ON `claims` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `client_representatives_client_idx` ON `client_representatives` (`clientId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `clients_archived_created_idx` ON `clients` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE INDEX `contract_items_contract_idx` ON `contract_items` (`contractId`);--> statement-breakpoint
CREATE INDEX `contract_items_vehicle_idx` ON `contract_items` (`vehicleId`);--> statement-breakpoint
CREATE INDEX `contracts_client_archived_created_idx` ON `contracts` (`clientId`,`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `contracts_archived_created_idx` ON `contracts` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `documents_archived_created_idx` ON `documents` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `documents_archived_expiry_idx` ON `documents` (`archivedAt`,`expiry`);--> statement-breakpoint
CREATE INDEX `documents_entity_idx` ON `documents` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `drivers_archived_created_idx` ON `drivers` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `drivers_vehicle_idx` ON `drivers` (`vehicleId`);--> statement-breakpoint
CREATE INDEX `employees_archived_created_idx` ON `employees` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `employees_department_idx` ON `employees` (`department`);--> statement-breakpoint
CREATE INDEX `inventory_items_archived_created_idx` ON `inventory_items` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `inventory_items_category_idx` ON `inventory_items` (`category`);--> statement-breakpoint
CREATE INDEX `maintenance_events_request_created_idx` ON `maintenance_events` (`maintenanceRequestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maintenance_requests_archived_created_idx` ON `maintenance_requests` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maintenance_requests_vehicle_created_idx` ON `maintenance_requests` (`vehicleId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maintenance_requests_stage_created_idx` ON `maintenance_requests` (`workflowStage`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maintenance_requests_status_idx` ON `maintenance_requests` (`status`);--> statement-breakpoint
CREATE INDEX `maintenance_requests_approval_idx` ON `maintenance_requests` (`approvalStatus`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_entity_idx` ON `notifications` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `payable_payments_payable_idx` ON `payable_payments` (`payableId`);--> statement-breakpoint
CREATE INDEX `payables_vehicle_archived_idx` ON `payables` (`vehicleId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `payables_archived_status_idx` ON `payables` (`archivedAt`,`status`);--> statement-breakpoint
CREATE INDEX `payables_archived_created_idx` ON `payables` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `payments_contract_archived_idx` ON `payments` (`contractId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `payments_claim_idx` ON `payments` (`claimId`);--> statement-breakpoint
CREATE INDEX `payments_client_idx` ON `payments` (`clientId`);--> statement-breakpoint
CREATE INDEX `projects_archived_created_idx` ON `projects` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `projects_client_archived_idx` ON `projects` (`clientId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `projects_contract_archived_idx` ON `projects` (`contractId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `projects_manager_idx` ON `projects` (`managerEmployeeId`);--> statement-breakpoint
CREATE INDEX `setting_catalog_category_idx` ON `setting_catalog` (`category`,`active`);--> statement-breakpoint
CREATE INDEX `tasks_archived_assignee_created_idx` ON `tasks` (`archivedAt`,`assigneeUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `vehicle_expenses_vehicle_archived_idx` ON `vehicle_expenses` (`vehicleId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `vehicle_revenues_vehicle_archived_idx` ON `vehicle_revenues` (`vehicleId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `vehicles_archived_created_idx` ON `vehicles` (`archivedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `vehicles_project_idx` ON `vehicles` (`projectId`);--> statement-breakpoint
CREATE INDEX `vehicles_driver_idx` ON `vehicles` (`driverId`);--> statement-breakpoint
CREATE INDEX `vehicles_employee_idx` ON `vehicles` (`employeeId`);--> statement-breakpoint
CREATE INDEX `vehicles_client_idx` ON `vehicles` (`clientId`);--> statement-breakpoint
CREATE INDEX `vehicles_contract_idx` ON `vehicles` (`contractId`);
