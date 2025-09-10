-- DropForeignKey
ALTER TABLE `connectedaccount` DROP FOREIGN KEY `ConnectedAccount_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `refreshtoken` DROP FOREIGN KEY `RefreshToken_user_id_fkey`;

-- DropIndex
DROP INDEX `ConnectedAccount_user_id_fkey` ON `connectedaccount`;

-- DropIndex
DROP INDEX `RefreshToken_user_id_fkey` ON `refreshtoken`;

-- AddForeignKey
ALTER TABLE `ConnectedAccount` ADD CONSTRAINT `ConnectedAccount_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
