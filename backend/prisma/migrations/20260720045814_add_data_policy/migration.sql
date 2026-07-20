-- AlterTable
ALTER TABLE "users" ADD COLUMN     "data_policy_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "data_policy_accepted_at" TIMESTAMP(3);
