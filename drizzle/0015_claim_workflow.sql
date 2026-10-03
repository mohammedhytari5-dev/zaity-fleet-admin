ALTER TABLE `claims` MODIFY COLUMN `status` enum('مستحقة','مدفوعة','متأخرة','ملغاة','غير مرفوعة','جديدة','تحت الإجراء','تم اعتمادها','تم صرفها','مرفوضة') NOT NULL DEFAULT 'جديدة';--> statement-breakpoint
UPDATE `claims` SET `status` = CASE `status` WHEN 'مدفوعة' THEN 'تم صرفها' WHEN 'مستحقة' THEN 'تم اعتمادها' WHEN 'متأخرة' THEN 'تحت الإجراء' ELSE `status` END;--> statement-breakpoint
ALTER TABLE `claims` MODIFY COLUMN `status` enum('غير مرفوعة','جديدة','تحت الإجراء','تم اعتمادها','تم صرفها','مرفوضة','ملغاة') NOT NULL DEFAULT 'جديدة';--> statement-breakpoint
ALTER TABLE `claims` ADD `submittedAt` varchar(32) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `claims` ADD `followUpAt` varchar(32) DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `claims` ADD `notes` text;
