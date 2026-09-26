CREATE TABLE `download_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`mediaId` varchar(128) NOT NULL,
	`sourceUrl` text NOT NULL,
	`platform` varchar(32) NOT NULL,
	`title` text NOT NULL,
	`creator` text,
	`duration` varchar(32),
	`formatId` varchar(64) NOT NULL,
	`container` varchar(16) NOT NULL,
	`quality` varchar(32) NOT NULL,
	`status` enum('queued','processing','completed','failed','expired','cancelled') NOT NULL DEFAULT 'completed',
	`downloadUrl` text,
	`filename` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `download_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`analyses` int NOT NULL DEFAULT 0,
	`downloads` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_counters_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_counters_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`defaultFormat` varchar(16) NOT NULL DEFAULT 'mp4',
	`preferredQuality` varchar(16) NOT NULL DEFAULT '720p',
	`theme` enum('light','dark','system') NOT NULL DEFAULT 'system',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `plan` enum('free','pro') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(128);