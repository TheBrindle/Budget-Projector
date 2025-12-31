-- CashFlow Database Schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cashflow_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  starting_balance DECIMAL(12,2) DEFAULT 0,
  starting_date DATE DEFAULT CURRENT_DATE,
  warning_threshold DECIMAL(12,2) DEFAULT 500,
  floor_threshold DECIMAL(12,2) DEFAULT 50,
  incomes JSONB DEFAULT '[]'::jsonb,
  expenses JSONB DEFAULT '[]'::jsonb,
  category_colors JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE cashflow_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON cashflow_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own data" ON cashflow_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON cashflow_data FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own data" ON cashflow_data FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_cashflow_data_updated_at BEFORE UPDATE ON cashflow_data
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cashflow_data_user_id ON cashflow_data(user_id);

-- Migration from old schema (run if upgrading from current_balance):
-- ALTER TABLE cashflow_data ADD COLUMN IF NOT EXISTS starting_balance DECIMAL(12,2) DEFAULT 0;
-- ALTER TABLE cashflow_data ADD COLUMN IF NOT EXISTS starting_date DATE DEFAULT CURRENT_DATE;
-- UPDATE cashflow_data SET starting_balance = current_balance WHERE starting_balance = 0;
-- ALTER TABLE cashflow_data DROP COLUMN IF EXISTS current_balance;

-- Migration to add category_colors:
-- ALTER TABLE cashflow_data ADD COLUMN IF NOT EXISTS category_colors JSONB DEFAULT '{}'::jsonb;
