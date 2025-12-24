-- Apply Review Package Support Migration
-- Run this SQL script in your MySQL database (phpMyAdmin or MySQL client)

-- DropForeignKey (if exists)
SET @foreign_key_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = 'barber_platform' 
    AND TABLE_NAME = 'Review' 
    AND CONSTRAINT_NAME = 'Review_visitId_fkey'
);

SET @sql = IF(@foreign_key_exists > 0,
    'ALTER TABLE `Review` DROP FOREIGN KEY `Review_visitId_fkey`',
    'SELECT "Foreign key does not exist, skipping..." AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable: Add packageId and make visitId nullable
ALTER TABLE `Review` 
    ADD COLUMN IF NOT EXISTS `packageId` INT NULL,
    MODIFY COLUMN `visitId` INT NULL;

-- AddForeignKey for visitId (with SET NULL on delete)
SET @foreign_key_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = 'barber_platform' 
    AND TABLE_NAME = 'Review' 
    AND CONSTRAINT_NAME = 'Review_visitId_fkey'
);

SET @sql = IF(@foreign_key_exists = 0,
    'ALTER TABLE `Review` ADD CONSTRAINT `Review_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key already exists, skipping..." AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AddForeignKey for packageId
SET @foreign_key_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = 'barber_platform' 
    AND TABLE_NAME = 'Review' 
    AND CONSTRAINT_NAME = 'Review_packageId_fkey'
);

SET @sql = IF(@foreign_key_exists = 0,
    'ALTER TABLE `Review` ADD CONSTRAINT `Review_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key already exists, skipping..." AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration applied successfully!' AS result;

