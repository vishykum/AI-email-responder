/*
  Warnings:

  - You are about to drop the `test` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `test`;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `display_email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_display_email_key`(`display_email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConnectedAccount` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `provider` ENUM('GOOGLE', 'YAHOO', 'OUTLOOK') NOT NULL,
    `provider_user_id` VARCHAR(191) NOT NULL,
    `email_address` VARCHAR(191) NOT NULL,
    `access_token_encrypted` VARCHAR(191) NOT NULL,
    `refresh_token_encrypted` VARCHAR(191) NOT NULL,
    `token_expiry` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED', 'ERROR') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConnectedAccount_email_address_key`(`email_address`),
    UNIQUE INDEX `ConnectedAccount_provider_provider_user_id_key`(`provider`, `provider_user_id`),
    UNIQUE INDEX `ConnectedAccount_id_provider_key`(`id`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Thread` (
    `id` VARCHAR(191) NOT NULL,
    `connected_account_id` VARCHAR(191) NOT NULL,
    `provider_thread_id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `last_message_at` DATETIME(3) NOT NULL,
    `message_count` INTEGER NOT NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Thread_connected_account_id_provider_thread_id_key`(`connected_account_id`, `provider_thread_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `thread_id` VARCHAR(191) NOT NULL,
    `connected_account_id` VARCHAR(191) NOT NULL,
    `provider_message_id` VARCHAR(191) NOT NULL,
    `from_address` VARCHAR(191) NOT NULL,
    `to_addresses` JSON NOT NULL,
    `cc_addresses` JSON NULL,
    `bcc_addresses` JSON NULL,
    `subject` VARCHAR(191) NOT NULL,
    `snippet` VARCHAR(191) NOT NULL,
    `internal_date` DATETIME(3) NOT NULL,
    `headers_json` JSON NOT NULL,
    `body_text` LONGTEXT NULL,
    `body_html` LONGTEXT NULL,
    `has_attachments` BOOLEAN NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Message_connected_account_id_provider_message_id_key`(`connected_account_id`, `provider_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `storage_url` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `size_bytes` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Label` (
    `id` VARCHAR(191) NOT NULL,
    `connected_account_id` VARCHAR(191) NOT NULL,
    `provider_label_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('SYSTEM', 'USER') NOT NULL,
    `color` VARCHAR(191) NULL,

    UNIQUE INDEX `Label_connected_account_id_provider_label_id_key`(`connected_account_id`, `provider_label_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageLabel` (
    `message_id` VARCHAR(191) NOT NULL,
    `label_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `MessageLabel_message_id_label_id_key`(`message_id`, `label_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prompt` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `target_type` ENUM('MESSAGE', 'THREAD') NOT NULL,
    `target_message_id` VARCHAR(191) NULL,
    `target_thread_id` VARCHAR(191) NULL,
    `prompt_text` LONGTEXT NOT NULL,
    `context_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIResponse` (
    `id` VARCHAR(191) NOT NULL,
    `prompt_id` VARCHAR(191) NOT NULL,
    `meta` JSON NOT NULL,
    `quality_score` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AIResponse_prompt_id_key`(`prompt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Draft` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `connected_account_id` VARCHAR(191) NOT NULL,
    `ai_response_id` VARCHAR(191) NOT NULL,
    `prompt_id` VARCHAR(191) NOT NULL,
    `thread_id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `status` ENUM('EDITING', 'SENT') NOT NULL DEFAULT 'EDITING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Draft_user_id_connected_account_id_message_id_key`(`user_id`, `connected_account_id`, `message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SentAction` (
    `id` VARCHAR(191) NOT NULL,
    `draft_id` VARCHAR(191) NOT NULL,
    `provider_message_id` VARCHAR(191) NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncState` (
    `id` VARCHAR(191) NOT NULL,
    `connected_account_id` VARCHAR(191) NOT NULL,
    `last_sync_token` VARCHAR(191) NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,
    `status` ENUM('IDLE', 'RUNNING', 'ERROR') NOT NULL,
    `error_message` MEDIUMTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `actor` ENUM('SYSTEM', 'USER') NOT NULL,
    `action` ENUM('SYNC', 'GENERATE', 'SEND') NOT NULL,
    `details_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConnectedAccount` ADD CONSTRAINT `ConnectedAccount_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Thread` ADD CONSTRAINT `Thread_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `ConnectedAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `Thread`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `ConnectedAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `Message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Label` ADD CONSTRAINT `Label_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `ConnectedAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageLabel` ADD CONSTRAINT `MessageLabel_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `Message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageLabel` ADD CONSTRAINT `MessageLabel_label_id_fkey` FOREIGN KEY (`label_id`) REFERENCES `Label`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prompt` ADD CONSTRAINT `Prompt_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prompt` ADD CONSTRAINT `Prompt_target_message_id_fkey` FOREIGN KEY (`target_message_id`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prompt` ADD CONSTRAINT `Prompt_target_thread_id_fkey` FOREIGN KEY (`target_thread_id`) REFERENCES `Thread`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIResponse` ADD CONSTRAINT `AIResponse_prompt_id_fkey` FOREIGN KEY (`prompt_id`) REFERENCES `Prompt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draft` ADD CONSTRAINT `Draft_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draft` ADD CONSTRAINT `Draft_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `ConnectedAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draft` ADD CONSTRAINT `Draft_ai_response_id_fkey` FOREIGN KEY (`ai_response_id`) REFERENCES `AIResponse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draft` ADD CONSTRAINT `Draft_prompt_id_fkey` FOREIGN KEY (`prompt_id`) REFERENCES `Prompt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draft` ADD CONSTRAINT `Draft_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `Thread`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draft` ADD CONSTRAINT `Draft_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `Message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SentAction` ADD CONSTRAINT `SentAction_draft_id_fkey` FOREIGN KEY (`draft_id`) REFERENCES `Draft`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SyncState` ADD CONSTRAINT `SyncState_connected_account_id_fkey` FOREIGN KEY (`connected_account_id`) REFERENCES `ConnectedAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
