-- MetaGO Studio 初始数据库 Schema
-- 包含 8 张表 + Row Level Security 策略
-- 执行方式：在 Supabase Dashboard > SQL Editor 中执行

-- ========== 1. user_settings 用户设置 ==========
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'zh',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的设置" ON user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== 2. decision_locks 决策锁记录 ==========
CREATE TABLE IF NOT EXISTS decision_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  ivl_passed BOOLEAN NOT NULL,
  ilt_passed BOOLEAN NOT NULL,
  osg_passed BOOLEAN NOT NULL,
  integrity_passed BOOLEAN NOT NULL,
  overall_passed BOOLEAN NOT NULL,
  ivl_detail JSONB,
  ilt_detail JSONB,
  osg_detail JSONB,
  integrity_detail JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE decision_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的决策锁记录" ON decision_locks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_decision_locks_user ON decision_locks(user_id, created_at DESC);

-- ========== 3. evolution_records 进化档案 ==========
CREATE TABLE IF NOT EXISTS evolution_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trigger TEXT NOT NULL,
  boundary TEXT NOT NULL,
  action TEXT,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE evolution_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的进化档案" ON evolution_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_evolution_records_user ON evolution_records(user_id, created_at DESC);

-- ========== 4. ability_dimensions 能力维度 ==========
CREATE TABLE IF NOT EXISTS ability_dimensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dimension TEXT NOT NULL,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, dimension)
);
ALTER TABLE ability_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的能力维度" ON ability_dimensions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== 5. private_skills 私有技能库 ==========
CREATE TABLE IF NOT EXISTS private_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  encrypted_content TEXT,
  tags TEXT[] DEFAULT '{}',
  history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE private_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的私有技能" ON private_skills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_private_skills_user ON private_skills(user_id, created_at DESC);

-- ========== 6. platform_configs 跨平台同步配置 ==========
CREATE TABLE IF NOT EXISTS platform_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform_id TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected',
  last_sync TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform_id)
);
ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的平台配置" ON platform_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== 7. sync_logs 同步日志 ==========
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的同步日志" ON sync_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sync_logs_user ON sync_logs(user_id, created_at DESC);

-- ========== 8. user_subscriptions Pro 订阅 ==========
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户管理自己的订阅" ON user_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== 9. updated_at 自动更新触发器 ==========
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_private_skills_updated_at BEFORE UPDATE ON private_skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_platform_configs_updated_at BEFORE UPDATE ON platform_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ability_dimensions_updated_at BEFORE UPDATE ON ability_dimensions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
