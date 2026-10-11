ALTER TABLE `inventory_requests` MODIFY COLUMN `status` enum('بانتظار الاعتماد','معتمد','معتمد جزئيًا','مرفوض','مصروف') NOT NULL DEFAULT 'بانتظار الاعتماد';
