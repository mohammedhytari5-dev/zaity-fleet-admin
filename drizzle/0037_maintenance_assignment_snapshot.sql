ALTER TABLE `maintenance_requests` ADD `projectIdAtRequest` int;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `projectNameAtRequest` varchar(200);--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `clientIdAtRequest` int;--> statement-breakpoint
ALTER TABLE `maintenance_requests` ADD `clientNameAtRequest` varchar(200);