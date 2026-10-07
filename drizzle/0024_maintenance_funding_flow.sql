ALTER TABLE `maintenance_requests`
  ADD `quotedPartsCost` int NOT NULL DEFAULT 0,
  ADD `quoteName` varchar(255),
  ADD `quoteUrl` mediumtext,
  ADD `fundingType` enum('عهدة','تحويل مباشر'),
  ADD `fundingReference` varchar(120),
  ADD `fundingAmount` int,
  ADD `fundingRecipient` varchar(160),
  ADD `advanceStatus` enum('مفتوحة','مسواة'),
  ADD `advanceSettledAt` timestamp NULL,
  ADD `advanceSettlementReference` varchar(120),
  ADD `fundingIssuedAt` timestamp NULL,
  ADD `fundingIssuedByUserId` int,
  ADD `fundingIssuedByName` varchar(160);
--> statement-breakpoint

UPDATE `maintenance_requests`
SET `workflowStage` = 'اعتماد', `approvalStatus` = 'بانتظار الاعتماد'
WHERE `workflowStage` IN ('بلاغ','فحص','تشخيص','تقدير تكلفة')
  AND `approvalStatus` IN ('غير مطلوب','بانتظار الاعتماد');
