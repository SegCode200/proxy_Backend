/*
  Warnings:

  - You are about to alter the column `status` on the `listing` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.
  - Added the required column `price` to the `Listing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `listing` ADD COLUMN `price` DOUBLE NOT NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REMOVED') NOT NULL DEFAULT 'PENDING';
