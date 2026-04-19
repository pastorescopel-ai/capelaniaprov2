import webpush from 'web-push';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidEmail: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export class NotificationManager {
  private supabase;
  private config: PushConfig;

  constructor(config: PushConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);

    if (config.vapidPublicKey && config.vapidPrivateKey) {
      webpush.setVapidDetails(
        config.vapidEmail || 'mailto:admin@capelaniahab.com.br',
        config.vapidPublicKey,
        config.vapidPrivateKey
      );
      logger.info('NotificationManager: VAPID details set.');
    } else {
      logger.warn('NotificationManager: VAPID keys missing. Push notifications disabled.');
    }
  }

  async sendPushNotification(userId: string, payload: { title: string; body: string; data?: any }) {
    try {
      // Fetch subscriptions for this user
      const { data: subs, error } = await this.supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      if (!subs || subs.length === 0) return;

      const pushPromises = subs.map(subRecord => {
        const subscription = typeof subRecord.subscription === 'string' 
          ? JSON.parse(subRecord.subscription) 
          : subRecord.subscription;

        return webpush.sendNotification(subscription, JSON.stringify(payload))
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              // Subscription expired or no longer valid, delete it
              return this.supabase.from('push_subscriptions').delete().eq('id', subRecord.id);
            }
            logger.error(`Error sending push to user ${userId}:`, err);
          });
      });

      await Promise.all(pushPromises);
    } catch (err) {
      logger.error('Failed to send push notification:', err);
    }
  }

  setupSchedules() {
    // 1. Relatório Diário Pendente (20:00 todos os dias)
    cron.schedule('0 20 * * *', async () => {
      logger.info('Cron: Checking for missing daily reports...');
      const today = new Date().toISOString().split('T')[0];
      
      try {
        // Encontrar todos os capelães/internos (Usando uppercase conforme enums.ts)
        const { data: users, error: userError } = await this.supabase
          .from('users')
          .select('id, name')
          .in('role', ['CHAPLAIN', 'INTERN']);

        if (userError) throw userError;

        for (const user of (users || [])) {
          // Verificar se já enviou hoje
          const { data: report, error: reportError } = await this.supabase
            .from('daily_activity_reports')
            .select('id')
            .eq('user_id', user.id)
            .eq('date', today)
            .maybeSingle();

          if (!report && !reportError) {
            await this.sendPushNotification(user.id, {
              title: 'Relatório Pendente 📝',
              body: `Olá ${user.name}, você ainda não registrou suas atividades de hoje.`,
              data: { url: '/activities' }
            });
          }
        }
      } catch (err) {
        logger.error('Error in daily report cron:', err);
      }
    });

    // 2. Alerta de Visitas Próximas (a cada 15 min)
    cron.schedule('*/15 * * * *', async () => {
      logger.info('Cron: Checking for upcoming visits...');
      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      
      try {
        // Buscar agendamentos próximos (nos próximos 30 min) que ainda não foram notificados
        // Nota: Precisaríamos de um campo 'notified' na tabela de agendamentos ou visits
        // Para este exemplo, vamos assumir 'visit_requests' ou uma tabela de agenda
        const { data: visits, error } = await this.supabase
          .from('visit_requests')
          .select('*')
          .eq('status', 'scheduled') // ou 'assigned'
          .gte('scheduled_time', now.toISOString())
          .lte('scheduled_time', in30Minutes.toISOString());

        if (error) throw error;

        for (const visit of (visits || [])) {
          if (visit.assigned_chaplain_id) {
            await this.sendPushNotification(visit.assigned_chaplain_id, {
              title: 'Próxima Visita 🏥',
              body: `Você tem uma visita agendada em breve: ${visit.pg_name || 'Paciente'}`,
              data: { url: '/visits' }
            });
          }
        }
      } catch (err) {
        logger.error('Error in upcoming visits cron:', err);
      }
    });

    logger.info('NotificationManager: Schedules initialized.');
  }
}
