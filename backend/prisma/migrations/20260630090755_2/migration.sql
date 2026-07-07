-- Migración para crear la tabla de recursos asociados a una modalidad de grado.
-- Sirve para almacenar archivos o documentos relacionados con una modalidad,
-- como plantillas, instructivos o recursos de apoyo, junto con su metadata.
-- CreateTable
CREATE TABLE "modality_resources" (
    "id" UUID NOT NULL,
    "modality_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_byte" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modality_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modality_resources_modality_id_idx" ON "modality_resources"("modality_id");

-- AddForeignKey
ALTER TABLE "modality_resources" ADD CONSTRAINT "modality_resources_modality_id_fkey" FOREIGN KEY ("modality_id") REFERENCES "degree_modalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modality_resources" ADD CONSTRAINT "modality_resources_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
