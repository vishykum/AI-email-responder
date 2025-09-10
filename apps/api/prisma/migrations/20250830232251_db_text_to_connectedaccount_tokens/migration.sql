-- AlterTable
ALTER TABLE `connectedaccount` MODIFY `access_token_encrypted` TEXT NOT NULL,
    MODIFY `refresh_token_encrypted` TEXT NOT NULL;
