CREATE TABLE IF NOT EXISTS `custodies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `branch_id` int NOT NULL DEFAULT 1,
  `code` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,
  `custody_type` varchar(64) NOT NULL,
  `custodian_type` varchar(32) NOT NULL DEFAULT 'employee',
  `custodian_id` int NOT NULL,
  `custodian_name` varchar(255) NOT NULL,
  `payment_method` varchar(64) NOT NULL DEFAULT 'تحويل بنكي',
  `reference_number` varchar(120) DEFAULT NULL,
  `receipt_doc_name` varchar(255) DEFAULT NULL,
  `receipt_doc_url` mediumtext DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `spent_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `remaining_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `acceptance_status` varchar(32) NOT NULL DEFAULT 'بانتظار الاستلام',
  `accepted_at` timestamp NULL DEFAULT NULL,
  `accepted_amount` decimal(15,2) DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'نشطة',
  `settled_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by_user_id` int DEFAULT NULL,
  `created_by_name` varchar(160) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `custodies_code_unique` (`code`)
);

CREATE TABLE IF NOT EXISTS `custody_expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `custody_id` int NOT NULL,
  `description` varchar(255) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `expense_date` varchar(32) NOT NULL,
  `invoice_number` varchar(120) DEFAULT NULL,
  `invoice_doc_name` varchar(255) DEFAULT NULL,
  `invoice_doc_url` mediumtext DEFAULT NULL,
  `maintenance_request_id` int DEFAULT NULL,
  `vehicle_id` int DEFAULT NULL,
  `reported_by_user_id` int DEFAULT NULL,
  `reported_by_name` varchar(160) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `payroll_inquiries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payroll_id` int NOT NULL,
  `employee_or_driver_id` int NOT NULL,
  `person_type` varchar(32) NOT NULL DEFAULT 'driver',
  `person_name` varchar(255) NOT NULL,
  `deduction_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `inquiry_text` text NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'قيد المراجعة',
  `finance_response` text DEFAULT NULL,
  `proof_doc_name` varchar(255) DEFAULT NULL,
  `proof_doc_url` mediumtext DEFAULT NULL,
  `responded_by_user_id` int DEFAULT NULL,
  `responded_by_name` varchar(160) DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

ALTER TABLE `maintenance_requests`
  ADD COLUMN `damage_photos` mediumtext DEFAULT NULL,
  ADD COLUMN `driver_completed_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `driver_invoice_url` mediumtext DEFAULT NULL,
  ADD COLUMN `driver_notes` text DEFAULT NULL;
