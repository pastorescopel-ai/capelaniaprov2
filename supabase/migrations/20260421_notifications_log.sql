
-- Migration: Notificações Automáticas e Logs
-- Tabelas necessárias para o sistema de notificações PUSH e CRON

-- 1. Tabela de Subscrições (Browser/Dispositivo)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subscription)
);

-- 2. Tabela de Configuraåções de Gatilhos
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  scheduled_time TEXT, -- HH:mm ou Frequência
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Log de Envios (Evita duplicidade)
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  reference_date DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_type, reference_date)
);

-- 4. Inserir Configurações Iniciais
INSERT INTO notification_settings (id, description, enabled, scheduled_time)
VALUES 
  ('daily_report', 'Lembrete de Relatório Diário', true, '23:00'),
  ('visit_alert', 'Alerta de Visitas Próximas', true, '15'),
  ('dashboard_pending', 'Atividades Pendentes no Dashboard', true, '21:00')
ON CONFLICT (id) DO UPDATE SET 
  description = EXCLUDED.description;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_lookup ON notification_log(user_id, notification_type, reference_date);
