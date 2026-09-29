-- AlterTable
ALTER TABLE `Admin` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `Admin_role_idx` ON `Admin`(`role`);

-- CreateIndex
CREATE INDEX `Admin_active_idx` ON `Admin`(`active`);

-- AlterTable
ALTER TABLE `Shipment` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Shipment_deletedAt_idx` ON `Shipment`(`deletedAt`);
