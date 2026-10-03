ALTER TABLE `payables` ADD `vehicleId` int;--> statement-breakpoint
ALTER TABLE `payables` ADD `vehicleCategory` enum('صيانة','قطع غيار','زيوت وفلاتر','إطارات','إصلاحات وأعطال','تأمين','فحص واستمارة','مخالفات','أخرى');--> statement-breakpoint
ALTER TABLE `payables` ADD `receiptName` varchar(255);--> statement-breakpoint
ALTER TABLE `payables` ADD `receiptUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD `payableId` int;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_payableId_unique` UNIQUE(`payableId`);