-- ================================================================
-- Migration: Signature Module Improvements
-- Date: 2026-05-20
-- Changes:
--   1. Drop old unique constraint (documentTypeId, signerRole) on signature_configs
--   2. Add new unique constraint (documentTypeId, signerRole, displayOrder)
--      to allow multiple signers of the same role with different display orders
-- ================================================================

-- Drop old constraint
ALTER TABLE "signature_configs" DROP CONSTRAINT IF EXISTS "signature_configs_document_type_id_signer_role_key";

-- Add new composite unique constraint
ALTER TABLE "signature_configs"
  ADD CONSTRAINT "signature_configs_document_type_id_signer_role_display_order_key"
  UNIQUE ("document_type_id", "signer_role", "display_order");
