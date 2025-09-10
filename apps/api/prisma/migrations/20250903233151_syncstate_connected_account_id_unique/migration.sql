/*
  Warnings:

  - A unique constraint covering the columns `[connected_account_id]` on the table `SyncState` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `SyncState_connected_account_id_key` ON `SyncState`(`connected_account_id`);
