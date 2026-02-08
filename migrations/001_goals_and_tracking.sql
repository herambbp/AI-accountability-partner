-- Migration: OKR/KPI Goal-Setting & Tracking
-- Run this in your Supabase SQL Editor

-- Goals table
CREATE TABLE goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  objective TEXT NOT NULL,
  context TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key Results table
CREATE TABLE key_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'count',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KPIs table
CREATE TABLE kpis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('number', 'boolean', 'time')),
  daily_target JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Logs table
CREATE TABLE daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  kpi_values JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, log_date)
);

-- WhatsApp Contacts table
CREATE TABLE whatsapp_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  phone_number TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Google Sheet ID to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS google_sheet_id TEXT;

-- Indexes for performance
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_key_results_goal_id ON key_results(goal_id);
CREATE INDEX idx_kpis_goal_id ON kpis(goal_id);
CREATE INDEX idx_daily_logs_goal_id ON daily_logs(goal_id);
CREATE INDEX idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date);
CREATE INDEX idx_whatsapp_contacts_user_id ON whatsapp_contacts(user_id);
