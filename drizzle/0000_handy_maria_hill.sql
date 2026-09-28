CREATE TABLE `order_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`status` text DEFAULT 'READY' NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`ready_rows` integer DEFAULT 0 NOT NULL,
	`hold_rows` integer DEFAULT 0 NOT NULL,
	`failed_rows` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`line_no` integer NOT NULL,
	`order_id` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`product_name` text DEFAULT '' NOT NULL,
	`quantity` text DEFAULT '' NOT NULL,
	`expected_price` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`recipient_name` text DEFAULT '' NOT NULL,
	`recipient_phone` text DEFAULT '' NOT NULL,
	`zipcode` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`address_detail` text DEFAULT '' NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'READY' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `order_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
