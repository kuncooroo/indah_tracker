-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeadlineNotificationLog` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `dayKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeadlineNotificationLog_dayKey_idx`(`dayKey`),
    INDEX `DeadlineNotificationLog_shipmentId_idx`(`shipmentId`),
    UNIQUE INDEX `DeadlineNotificationLog_shipmentId_channel_dayKey_key`(`shipmentId`, `channel`, `dayKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeadlineNotificationLog` ADD CONSTRAINT `DeadlineNotificationLog_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default soonDays
INSERT INTO `AppSetting` (`key`, `value`, `updatedAt`)
VALUES ('REMINDER_SOON_DAYS', '2', NOW(3))
ON DUPLICATE KEY UPDATE `value` = `value`;
