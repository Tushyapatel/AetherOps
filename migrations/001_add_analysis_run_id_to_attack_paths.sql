-- 001_add_analysis_run_id_to_attack_paths.sql
ALTER TABLE attack_paths
ADD COLUMN analysis_run_id BIGINT;

ALTER TABLE attack_paths
ADD COLUMN path_hash VARCHAR(255);

ALTER TABLE attack_paths
ADD CONSTRAINT uq_attack_path_hash UNIQUE (analysis_run_id, path_hash);
