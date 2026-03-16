CREATE TABLE `element_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`nameEn` varchar(255) NOT NULL,
	`description` text,
	`icon` varchar(100) DEFAULT 'widgets',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `element_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `element_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `element_usage_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`elementId` int NOT NULL,
	`triggerContext` varchar(100) NOT NULL,
	`ruleDescription` text,
	`priority` int DEFAULT 5,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `element_usage_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slide_elements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int,
	`categoryId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`sourceSlideNumber` int,
	`previewUrl` text,
	`previewKey` varchar(512),
	`designTemplate` json,
	`styleProperties` json,
	`contentSlots` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`usageCount` int DEFAULT 0,
	`qualityRating` int DEFAULT 3,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `slide_elements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slide_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`fileUrl` text,
	`fileKey` varchar(512),
	`slideCount` int DEFAULT 0,
	`elementCount` int DEFAULT 0,
	`status` enum('uploading','processing','ready','failed') NOT NULL DEFAULT 'uploading',
	`errorMessage` text,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `slide_templates_id` PRIMARY KEY(`id`)
);
