-- Migración de ajuste para la configuración de firmas digitales.
-- Elimina un índice duplicado y renombra otro para mantener coherencia en la base de datos.
-- DropIndex
DROP INDEX "signature_configs_document_type_id_signer_role_key";

-- RenameIndex
ALTER INDEX "signature_configs_document_type_id_signer_role_display_order_ke" RENAME TO "signature_configs_document_type_id_signer_role_display_orde_key";
