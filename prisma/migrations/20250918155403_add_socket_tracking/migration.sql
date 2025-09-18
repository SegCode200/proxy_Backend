-- AlterTable
ALTER TABLE `session` ADD COLUMN `isOnline` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `socketId` VARCHAR(191) NULL;
