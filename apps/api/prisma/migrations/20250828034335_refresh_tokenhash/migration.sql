/*
  Warnings:

  - The primary key for the `refreshtoken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `token` on the `refreshtoken` table. All the data in the column will be lost.
  - Added the required column `tokenHash` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `refreshtoken` DROP PRIMARY KEY,
    DROP COLUMN `token`,
    ADD COLUMN `tokenHash` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`tokenHash`);
