/*
  Warnings:

  - You are about to drop the column `conversation` on the `message` table. All the data in the column will be lost.
  - Added the required column `content` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `message` DROP COLUMN `conversation`,
    ADD COLUMN `content` VARCHAR(191) NOT NULL,
    ADD COLUMN `listingId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
