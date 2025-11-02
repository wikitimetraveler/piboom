-- Migration script to update state_abbr column from CHAR(2) to VARCHAR(3)
-- This allows Canadian province codes (3 characters) while maintaining US state codes (2 characters)

-- First, check if column exists and current type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'disasters' AND column_name = 'state_abbr'
  ) THEN
    -- Alter column to VARCHAR(3) to support Canadian provinces
    ALTER TABLE disasters ALTER COLUMN state_abbr TYPE VARCHAR(3);
    RAISE NOTICE 'Updated state_abbr column to VARCHAR(3)';
  ELSE
    RAISE NOTICE 'Column state_abbr does not exist';
  END IF;
END $$;

