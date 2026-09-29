-- Performance indexes for list / track / progress queries
CREATE INDEX `Shipment_deletedAt_createdAt_idx` ON `Shipment`(`deletedAt`, `createdAt`);
CREATE INDEX `Shipment_deletedAt_status_idx` ON `Shipment`(`deletedAt`, `status`);
CREATE INDEX `Shipment_status_estimatedEndDate_idx` ON `Shipment`(`status`, `estimatedEndDate`);
CREATE INDEX `ProgressTask_shipmentId_status_idx` ON `ProgressTask`(`shipmentId`, `status`);
CREATE INDEX `ProgressTask_shipmentId_parentId_idx` ON `ProgressTask`(`shipmentId`, `parentId`);
