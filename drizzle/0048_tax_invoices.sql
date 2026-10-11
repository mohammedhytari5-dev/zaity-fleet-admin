-- Electronic Invoicing & Tax (الفوترة الإلكترونية وضريبة القيمة المضافة)
--
-- Adds ZATCA Phase 1 & 2 compliant tax invoice tables:
--   1. `tax_invoices` (Standard & Simplified Tax Invoices / الفواتير الضريبية والمبسطة)
--   2. `tax_invoice_lines` (Invoice Line Items & VAT breakdown / بنود الفاتورة وضريبة كل بند)

CREATE TABLE IF NOT EXISTS `tax_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`uuid` varchar(64) NOT NULL,
	`invoiceType` enum('standard','simplified') NOT NULL DEFAULT 'simplified',
	`documentType` enum('invoice','credit_note','debit_note') NOT NULL DEFAULT 'invoice',
	`issueDate` date NOT NULL,
	`issueTime` varchar(16) NOT NULL DEFAULT '12:00:00',
	`sellerName` varchar(200) NOT NULL,
	`sellerVatNumber` varchar(32) NOT NULL,
	`sellerAddress` varchar(300) NOT NULL DEFAULT '—',
	`sellerBuildingNo` varchar(16),
	`sellerPostalCode` varchar(16),
	`sellerCity` varchar(80) NOT NULL DEFAULT 'الرياض',
	`sellerDistrict` varchar(80) NOT NULL DEFAULT '—',
	`buyerName` varchar(200) NOT NULL,
	`buyerVatNumber` varchar(32),
	`buyerAddress` varchar(300),
	`buyerCity` varchar(80),
	`branchId` int NOT NULL DEFAULT 1,
	`contractId` int,
	`clientId` int,
	`claimId` int,
	`vehicleId` int,
	`originalInvoiceId` int,
	`totalExcludingVat` decimal(15,2) NOT NULL DEFAULT '0.00',
	`totalDiscount` decimal(15,2) NOT NULL DEFAULT '0.00',
	`totalVat` decimal(15,2) NOT NULL DEFAULT '0.00',
	`totalIncludingVat` decimal(15,2) NOT NULL DEFAULT '0.00',
	`qrCodeData` text NOT NULL,
	`invoiceHash` varchar(128),
	`previousInvoiceHash` varchar(128),
	`zatcaStatus` enum('pending','reported','cleared','rejected') NOT NULL DEFAULT 'pending',
	`zatcaResponse` text,
	`notes` text,
	`journalEntryId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tax_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`),
	CONSTRAINT `tax_invoices_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tax_invoice_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`itemDescription` varchar(300) NOT NULL,
	`quantity` decimal(12,3) NOT NULL DEFAULT '1.000',
	`unitPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
	`discount` decimal(15,2) NOT NULL DEFAULT '0.00',
	`subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
	`vatRate` decimal(5,2) NOT NULL DEFAULT '15.00',
	`vatAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
	`total` decimal(15,2) NOT NULL DEFAULT '0.00',
	`vatCategory` varchar(10) NOT NULL DEFAULT 'S',
	`lineOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tax_invoice_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tax_invoices_date_branch_idx` ON `tax_invoices` (`issueDate`,`branchId`);--> statement-breakpoint
CREATE INDEX `tax_invoices_status_idx` ON `tax_invoices` (`zatcaStatus`);--> statement-breakpoint
CREATE INDEX `tax_invoices_type_idx` ON `tax_invoices` (`invoiceType`,`documentType`);--> statement-breakpoint
CREATE INDEX `tax_invoices_client_idx` ON `tax_invoices` (`clientId`);--> statement-breakpoint
CREATE INDEX `tax_invoices_contract_idx` ON `tax_invoices` (`contractId`);--> statement-breakpoint
ALTER TABLE `tax_invoices` ADD CONSTRAINT `tax_invoices_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_invoices` ADD CONSTRAINT `tax_invoices_contractId_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_invoices` ADD CONSTRAINT `tax_invoices_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_invoices` ADD CONSTRAINT `tax_invoices_claimId_claims_id_fk` FOREIGN KEY (`claimId`) REFERENCES `claims`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_invoices` ADD CONSTRAINT `tax_invoices_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_invoices` ADD CONSTRAINT `tax_invoices_original_fk` FOREIGN KEY (`originalInvoiceId`) REFERENCES `tax_invoices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_invoices` ADD CONSTRAINT `tax_invoices_journalEntryId_journal_entries_id_fk` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tax_invoice_lines_invoice_idx` ON `tax_invoice_lines` (`invoiceId`);--> statement-breakpoint
ALTER TABLE `tax_invoice_lines` ADD CONSTRAINT `tax_invoice_lines_invoiceId_tax_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `tax_invoices`(`id`) ON DELETE cascade ON UPDATE no action;
