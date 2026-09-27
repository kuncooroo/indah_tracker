-- Drop legacy simple events (replaced by WBS progress)
DROP TABLE IF EXISTS `ShipmentEvent`;

-- Alter Shipment for WBS fields
ALTER TABLE `Shipment`
  MODIFY `progressPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `wbsTemplateId` VARCHAR(191) NULL,
  ADD COLUMN `estimatedDays` INT NULL,
  ADD COLUMN `estimatedEndDate` DATETIME(3) NULL;

-- Remove estimatedDate if exists (replaced by estimatedEndDate)
-- MySQL: ignore if column missing via procedure-less approach — column may not exist on all envs
SET @db := DATABASE();
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Shipment' AND COLUMN_NAME = 'estimatedDate'
);
SET @sql := IF(@exists > 0, 'ALTER TABLE `Shipment` DROP COLUMN `estimatedDate`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `WbsTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `estimatedDays` INT NOT NULL DEFAULT 30,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WbsTemplateItem` (
  `id` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `estimatedHours` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `WbsTemplateItem_templateId_idx`(`templateId`),
  INDEX `WbsTemplateItem_parentId_idx`(`parentId`),
  CONSTRAINT `WbsTemplateItem_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `WbsTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WbsTemplateItem_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `WbsTemplateItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProgressTask` (
  `id` VARCHAR(191) NOT NULL,
  `shipmentId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `weightPercent` DECIMAL(5, 2) NOT NULL,
  `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
  `estimatedDays` INT NULL,
  `estimatedHours` INT NULL,
  `actualHours` INT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ProgressTask_shipmentId_idx`(`shipmentId`),
  INDEX `ProgressTask_parentId_idx`(`parentId`),
  INDEX `ProgressTask_status_idx`(`status`),
  CONSTRAINT `ProgressTask_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProgressTask_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProgressTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProgressPhoto` (
  `id` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `url` TEXT NOT NULL,
  `caption` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ProgressPhoto_taskId_idx`(`taskId`),
  CONSTRAINT `ProgressPhoto_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ProgressTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FK shipment -> wbs template
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Shipment'
    AND CONSTRAINT_NAME = 'Shipment_wbsTemplateId_fkey'
);
SET @sql2 := IF(@fk_exists = 0,
  'ALTER TABLE `Shipment` ADD INDEX `Shipment_wbsTemplateId_idx`(`wbsTemplateId`), ADD CONSTRAINT `Shipment_wbsTemplateId_fkey` FOREIGN KEY (`wbsTemplateId`) REFERENCES `WbsTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
