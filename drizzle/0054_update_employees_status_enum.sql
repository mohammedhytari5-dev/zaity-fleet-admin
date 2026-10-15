ALTER TABLE `employees` MODIFY COLUMN `status` ENUM('نشط','في إجازة','إجازة','موقوف','منتهي الخدمة') NOT NULL DEFAULT 'نشط';
