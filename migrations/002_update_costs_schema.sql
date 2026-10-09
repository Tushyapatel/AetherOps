ALTER TABLE costs RENAME COLUMN month TO period_start;
ALTER TABLE costs ADD COLUMN period_end DATE;
ALTER TABLE costs ADD COLUMN granularity VARCHAR(20);
ALTER TABLE costs ADD COLUMN metric VARCHAR(50);

UPDATE costs SET period_end = period_start + interval '1 month', granularity = 'MONTHLY', metric = 'UnblendedCost';

ALTER TABLE costs ALTER COLUMN period_end SET NOT NULL;
ALTER TABLE costs ALTER COLUMN granularity SET NOT NULL;
ALTER TABLE costs ALTER COLUMN metric SET NOT NULL;

ALTER TABLE costs ADD CONSTRAINT costs_unique_record UNIQUE (account_id, service_name, period_start, period_end, granularity, metric);
