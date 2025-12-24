-- DropForeignKey
ALTER TABLE `review` DROP FOREIGN KEY `Review_visitId_fkey`;

-- AlterTable
ALTER TABLE `review` ADD COLUMN `packageId` INTEGER NULL,
    MODIFY `visitId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
