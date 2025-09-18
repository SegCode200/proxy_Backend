-- AlterTable
ALTER TABLE `report` ADD COLUMN `resolved` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `isBanned` BOOLEAN NOT NULL DEFAULT false;
