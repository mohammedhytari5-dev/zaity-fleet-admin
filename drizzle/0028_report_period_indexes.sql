CREATE INDEX `payable_payments_paid_idx` ON `payable_payments` (`paidAt`);--> statement-breakpoint
CREATE INDEX `payments_archived_paid_idx` ON `payments` (`archivedAt`,`paidAt`);--> statement-breakpoint
CREATE INDEX `vehicle_expenses_archived_spent_idx` ON `vehicle_expenses` (`archivedAt`,`spentAt`);--> statement-breakpoint
CREATE INDEX `vehicle_revenues_payment_archived_idx` ON `vehicle_revenues` (`paymentId`,`archivedAt`);