-- update_gastos_dates_fix.sql
-- Shifts all existing expense dates forward by 12 hours (Midnight UTC -> Noon UTC)
-- This fixes the display issue where dates appeared as the previous day in local time.
UPDATE gastos 
SET created_at = created_at + interval '12 hours';
