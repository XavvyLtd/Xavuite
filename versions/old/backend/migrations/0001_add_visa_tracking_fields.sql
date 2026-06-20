-- Migration number: 0001 	 2026-06-02T13:10:22.903Z
ALTER TABLE employees ADD COLUMN brp_no TEXT;
ALTER TABLE employees ADD COLUMN visa_start_date TEXT;
ALTER TABLE employees ADD COLUMN visa_end_date TEXT;