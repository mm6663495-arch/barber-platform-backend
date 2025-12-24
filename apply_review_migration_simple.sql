-- Simple SQL to apply Review Package Support Migration
-- Run this in phpMyAdmin or MySQL client

-- Step 1: Drop existing foreign key (if exists)
ALTER TABLE `Review` DROP FOREIGN KEY IF EXISTS `Review_visitId_fkey`;

-- Step 2: Add packageId column and make visitId nullable
ALTER TABLE `Review` 
    ADD COLUMN `packageId` INT NULL,
    MODIFY COLUMN `visitId` INT NULL;

-- Step 3: Re-add foreign key for visitId with SET NULL
ALTER TABLE `Review` 
    ADD CONSTRAINT `Review_visitId_fkey` 
    FOREIGN KEY (`visitId`) 
    REFERENCES `Visit`(`id`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;

-- Step 4: Add foreign key for packageId
ALTER TABLE `Review` 
    ADD CONSTRAINT `Review_packageId_fkey` 
    FOREIGN KEY (`packageId`) 
    REFERENCES `Package`(`id`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;

