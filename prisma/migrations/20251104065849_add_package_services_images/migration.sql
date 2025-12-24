-- AlterTable
ALTER TABLE `package` ADD COLUMN `images` JSON NOT NULL,
    ADD COLUMN `services` JSON NOT NULL;
