-- CreateTable: signature_images
CREATE TABLE "signature_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "image_path" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable: signature_configs
CREATE TABLE "signature_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_type_id" UUID NOT NULL,
    "signer_role" TEXT NOT NULL,
    "signature_image_id" UUID,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_configs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: digital_signatures - add signature_image_id
ALTER TABLE "digital_signatures" ADD COLUMN "signature_image_id" UUID;

-- CreateIndex: unique user per signature image
CREATE UNIQUE INDEX "signature_images_user_id_key" ON "signature_images"("user_id");

-- CreateIndex: unique document_type + signer_role per config
CREATE UNIQUE INDEX "signature_configs_document_type_id_signer_role_key" ON "signature_configs"("document_type_id", "signer_role");

-- AddForeignKey: signature_images -> users (user)
ALTER TABLE "signature_images" ADD CONSTRAINT "signature_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: signature_images -> users (uploader)
ALTER TABLE "signature_images" ADD CONSTRAINT "signature_images_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: signature_configs -> document_types
ALTER TABLE "signature_configs" ADD CONSTRAINT "signature_configs_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: signature_configs -> signature_images
ALTER TABLE "signature_configs" ADD CONSTRAINT "signature_configs_signature_image_id_fkey" FOREIGN KEY ("signature_image_id") REFERENCES "signature_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: digital_signatures -> signature_images
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_signature_image_id_fkey" FOREIGN KEY ("signature_image_id") REFERENCES "signature_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
