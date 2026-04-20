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

  async checkDailyReports() {
    logger.info('Task: Checking for missing daily reports...');
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data: users, error: userError } = await this.supabase
        .from('users')
        .select('id, name')
        .in('role', ['CHAPLAIN', 'INTERN']);

      if (userError) throw userError;

      let count = 0;
      for (const user of (users || [])) {
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
          count++;
        }
      }
      return { status: 'success', sent: count };
    } catch (err) {
      logger.error('Error in daily report task:', err);
      throw err;
    }
  }

  async checkUpcomingVisits() {
    logger.info('Task: Checking for upcoming visits...');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
    
    try {
      // 1. Busca visitas agendadas para os próximos 30 minutos
      const { data: visits, error } = await this.supabase
        .from('visit_requests')
        .select('*')
        .eq('status', 'scheduled')
        .gte('scheduled_time', now.toISOString())
        .lte('scheduled_time', in30Minutes.toISOString());

      if (error) throw error;

      let count = 0;
      for (const visit of (visits || [])) {
        if (!visit.assigned_chaplain_id) continue;

        // 2. VERIFICAÇÃO DE INTEGRIDADE: O PG já foi registrado hoje?
        // Se já houver um registro de PG para este capelão e este grupo hoje, não notificamos
        const { data: existingPG } = await this.supabase
          .from('small_group_sessions')
          .select('id')
          .eq('user_id', visit.assigned_chaplain_id)
          .eq('group_name', visit.pg_name)
          .eq('date', today)
          .maybeSingle();

        // Também verificamos se não foi registrada como visita comum (Staff Visit)
        const { data: existingVisit } = await this.supabase
          .from('staff_visits')
          .select('id')
          .eq('user_id', visit.assigned_chaplain_id)
          .eq('date', today)
          .maybeSingle();

        if (existingPG || existingVisit) {
          // Já foi registrado! Marcamos o agendamento como concluído e pulamos
          logger.info(`Visit request ${visit.id} already recorded. Marking as completed.`);
          await this.supabase
            .from('visit_requests')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', visit.id);
          continue;
        }

        // 3. Se não foi registrado, enviamos o push
        await this.sendPushNotification(visit.assigned_chaplain_id, {
          title: 'Próxima Visita 🏥',
          body: `Você tem uma visita agendada em breve: ${visit.pg_name || 'Paciente'}`,
          data: { 
            url: visit.pg_name ? '/smallGroup' : '/staffVisit',
            requestId: visit.id
          }
        });
        count++;
      }
      return { status: 'success', sent: count };
    } catch (err) {
      logger.error('Error in upcoming visits task:', err);
      throw err;
    }
  }

  async broadcastToAll(payload: { title: string; body: string; data?: any }) {
    logger.info('Broadcast: Sending notification to all users...');
    try {
      const { data: subs, error } = await this.supabase
        .from('push_subscriptions')
        .select('*');

      if (error) throw error;
      if (!subs || subs.length === 0) return { status: 'success', sent: 0 };

      const pushPromises = subs.map(subRecord => {
        const subscription = typeof subRecord.subscription === 'string' 
          ? JSON.parse(subRecord.subscription) 
          : subRecord.subscription;

        return webpush.sendNotification(subscription, JSON.stringify(payload))
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              return this.supabase.from('push_subscriptions').delete().eq('id', subRecord.id);
            }
            logger.error(`Error sending broadcast push:`, err);
          });
      });

      await Promise.all(pushPromises);
      return { status: 'success', sent: subs.length };
    } catch (err) {
      logger.error('Failed to send broadcast:', err);
      throw err;
    }
  }

  async getSettings() {
    const { data, error } = await this.supabase.from('notification_settings').select('*');
    if (error) throw error;
    return data;
  }

  async updateSetting(id: string, updates: { enabled?: boolean; scheduled_time?: string }) {
    const { data, error } = await this.supabase
      .from('notification_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  setupSchedules() {
    // 1. Relatório Diário Pendente (20:00 todos os dias)
    cron.schedule('0 20 * * *', () => this.checkDailyReports());

    // 2. Alerta de Visitas Próximas (a cada 15 min)
    cron.schedule('*/15 * * * *', () => this.checkUpcomingVisits());

    logger.info('NotificationManager: Schedules initialized.');
  }
}
