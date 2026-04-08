-- Auditoría de envío SMTP (Email 1). Aplicar con: npm run migrate:email-envio-smtp

ALTER TABLE email_envios_solicitud
  ADD COLUMN enviado_en DATETIME NULL DEFAULT NULL AFTER updated_at,
  ADD COLUMN error_envio TEXT NULL DEFAULT NULL AFTER enviado_en;
