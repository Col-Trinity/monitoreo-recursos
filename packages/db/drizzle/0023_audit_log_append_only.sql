-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION audit_log_no_update_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es append-only: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_no_update_delete();
