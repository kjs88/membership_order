ALTER TABLE `order_jobs` ADD `created_by_name` text DEFAULT '알 수 없음' NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_jobs` ADD `created_by_email` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_jobs` ADD `updated_by_name` text DEFAULT '알 수 없음' NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_jobs` ADD `updated_by_email` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `order_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`action` text NOT NULL,
	`actor_name` text DEFAULT '알 수 없음' NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `order_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
