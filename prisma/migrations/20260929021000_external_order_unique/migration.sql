-- Deduplicate externalOrderId (keep earliest row) before unique index
UPDATE `Shipment` s1
INNER JOIN `Shipment` s2
  ON s1.`externalOrderId` = s2.`externalOrderId`
 AND s1.`id` > s2.`id`
SET s1.`externalOrderId` = NULL
WHERE s1.`externalOrderId` IS NOT NULL;

-- DropIndex (non-unique)
DROP INDEX `Shipment_externalOrderId_idx` ON `Shipment`;

-- CreateIndex unique (MySQL allows multiple NULL)
CREATE UNIQUE INDEX `Shipment_externalOrderId_key` ON `Shipment`(`externalOrderId`);
