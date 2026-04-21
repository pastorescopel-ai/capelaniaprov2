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

  private async isNotificationEnabled(type: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('notification_settings')
        .select('enabled')
        .eq('id', type)
        .maybeSingle();
      
      if (error || !data) return true; // Default to true if not found
      return data.enabled;
    } catch {
      return true;
    }
  }

  private async isAlreadySentToday(userId: string, type: string, date: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('notification_log')
        .select('id')
        .eq('user_id', userId)
        .eq('notification_type', type)
        .eq('reference_date', date)
        .maybeSingle();
      
      return !!data && !error;
    } catch {
      return false;
    }
  }

  private async logNotification(userId: string, type: string, date: string) {
    try {
      await this.supabase
        .from('notification_log')
        .insert({
          user_id: userId,
          notification_type: type,
          reference_date: date,
          sent_at: new Date().toISOString()
        });
    } catch (err) {
      logger.error('Error logging notification:', err);
    }
  }

  async sendPushNotification(userId: string, payload: { title: string; body: string; data?: any }, type?: string) {
    try {
      // Check if type is enabled
      if (type && !(await this.isNotificationEnabled(type))) {
        logger.info(`Notification type ${type} is disabled for user ${userId}`);
        return;
      }

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
      
      // Log if it's a tracked type
      if (type) {
        const today = new Date().toISOString().split('T')[0];
        await this.logNotification(userId, type, today);
      }
    } catch (err) {
      logger.error('Failed to send push notification:', err);
    }
  }

  async checkDailyReports() {
    logger.info('Task: Checking for missing daily reports...');
    const today = new Date().toISOString().split('T')[0];
    
    try {
      if (!(await this.isNotificationEnabled('daily_report'))) return { status: 'disabled' };

      const { data: users, error: userError } = await this.supabase
        .from('users')
        .select('id, name')
        .in('role', ['CHAPLAIN', 'INTERN']);

      if (userError) throw userError;

      let count = 0;
      for (const user of (users || [])) {
        // Skip if already sent today
        if (await this.isAlreadySentToday(user.id, 'daily_report', today)) continue;

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
          }, 'daily_report');
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
      if (!(await this.isNotificationEnabled('visit_alert'))) return { status: 'disabled' };

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

        // Skip if already notified for this specific visit ID? 
        // For alerts, we might use the visit ID as reference_date or just rely on schedule filtering
        // Actually, let's use visit_alert:visitId as type to avoid multiple same-visit alerts
        if (await this.isAlreadySentToday(visit.assigned_chaplain_id, `visit_alert:${visit.id}`, today)) continue;

        // 2. VERIFICAÇÃO DE INTEGRIDADE: O PG já foi registrado hoje?
        const { data: existingPG } = await this.supabase
          .from('small_group_sessions')
          .select('id')
          .eq('user_id', visit.assigned_chaplain_id)
          .eq('group_name', visit.pg_name)
          .eq('date', today)
          .maybeSingle();

        const { data: existingVisit } = await this.supabase
          .from('staff_visits')
          .select('id')
          .eq('user_id', visit.assigned_chaplain_id)
          .eq('date', today)
          .maybeSingle();

        if (existingPG || existingVisit) {
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
        }, `visit_alert:${visit.id}`);
        count++;
      }
      return { status: 'success', sent: count };
    } catch (err) {
      logger.error('Error in upcoming visits task:', err);
      throw err;
    }
  }

  async checkDashboardPendingActivities() {
    logger.info('Task: Checking for pending dashboard activities...');
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const todayISO = new Date(today.getTime() - offset).toISOString().split('T')[0];
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); 
    const monthStr = todayISO.substring(0, 7) + '-01';

    try {
      if (!(await this.isNotificationEnabled('dashboard_pending'))) return { status: 'disabled' };

      const { data: users, error: userError } = await this.supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['CHAPLAIN', 'INTERN']);

      if (userError) throw userError;

      const { data: schedules, error: schedError } = await this.supabase
        .from('activity_schedules')
        .select('*')
        .eq('month', monthStr)
        .or(`date.eq.${todayISO},and(date.is.null,day_of_week.eq.${dayOfWeek})`);

      if (schedError) throw schedError;

      const { data: reports, error: repError } = await this.supabase
        .from('daily_activity_reports')
        .select('*')
        .eq('date', todayISO);

      if (repError) throw repError;

      let count = 0;
      for (const user of (users || [])) {
        if (await this.isAlreadySentToday(user.id, 'dashboard_pending', todayISO)) continue;

        const userSchedules = schedules?.filter(s => s.user_id === user.id) || [];
        const userReport = reports?.find(r => r.user_id === user.id);
        
        // Logic similar to DailyActivitiesReminder.tsx
        const visitGoal = user.role === 'INTERN' ? 18 : 15;
        const totalItems = userSchedules.length + 1;

        let completedItems = 0;
        if (userReport) {
          completedItems = userSchedules.filter(s => {
            const period = s.period || 'tarde';
            const locWithPeriod = `${s.location}:${period}`;
            
            if (s.activity_type === 'blueprint') {
              return userReport.completed_blueprints?.includes(locWithPeriod) || 
                     (period === 'tarde' && userReport.completed_blueprints?.includes(s.location));
            }
            if (s.activity_type === 'cult') {
              return userReport.completed_cults?.includes(locWithPeriod) || 
                     (period === 'tarde' && userReport.completed_cults?.includes(s.location));
            }
            if (s.activity_type === 'encontro') return userReport.completed_encontro;
            if (s.activity_type === 'visite_cantando') return userReport.completed_visite_cantando;
            return false;
          }).length;

          const totalVisits = (userReport.palliative_count || 0) + 
                            (userReport.surgical_count || 0) + 
                            (userReport.pediatric_count || 0) + 
                            (userReport.uti_count || 0) + 
                            (userReport.terminal_count || 0) + 
                            (userReport.clinical_count || 0);

          if (totalVisits >= visitGoal) completedItems++;
        }

        const isFinished = totalItems > 0 ? (completedItems >= totalItems) : !!userReport;

        if (!isFinished) {
          await this.sendPushNotification(user.id, {
            title: 'Atividades Pendentes 🕒',
            body: `Olá ${user.name}, você ainda tem atividades pendentes no seu dashboard hoje.`,
            data: { url: '/activities' }
          }, 'dashboard_pending');
          count++;
        }
      }

      return { status: 'success', sent: count };
    } catch (err) {
      logger.error('Error in dashboard pending task:', err);
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

    // 3. Lembrete de Dashboard (18:00 todos os dias)
    cron.schedule('0 18 * * *', () => this.checkDashboardPendingActivities());

    logger.info('NotificationManager: Schedules initialized.');
  }
}
