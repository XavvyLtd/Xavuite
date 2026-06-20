-- Alternative to fix_naveen_compensation.sql — since these 3 rows are
-- test/placeholder values (£1, £0.001), simplest is to delete them
-- entirely and re-enter real compensation data through the now-fixed form.
DELETE FROM employee_compensation
WHERE id IN (
  'f3fef4b2-a57c-4aa9-aa20-4bc5672c57bb',
  'bf39d6d0-0002-4598-aa49-a749dde5151d',
  '4abfe059-e908-4022-be2e-9642ddca6e69'
);
