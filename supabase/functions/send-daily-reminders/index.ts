import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Disparada 2x/dia em dias úteis (12h e 18h horário de Belém) via pg_cron + pg_net -- ver migration
// 'schedule_daily_reminder_cron'. Autenticação por segredo compartilhado (x-cron-secret), não JWT.
//
// v5 (07/10/2026): o aviso de 18h passou a ser o "lembrete final" -- se a pessoa AINDA não registrou
// nenhuma atividade no dia, ele vai com urgency 'firm' (service worker: vibração longa e fica na tela
// até tocar). Além disso o payload agora leva `tag` (um aviso novo substitui o anterior em vez de
// empilhar) e `badgeCount` (número no ícone do app: visitas de PG pendentes + 1 se não registrou nada).
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey || !supabaseUrl || !serviceRoleKey) {
    console.error("Configuração ausente (VAPID ou Supabase).");
    return new Response(JSON.stringify({ error: "Configuração ausente no servidor." }), { status: 500 });
  }

  webpush.setVapidDetails("mailto:contato@hab.org.br", vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const nowUtc = new Date();
  const belemNow = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const todayStr = belemNow.toISOString().split("T")[0];
  // O cron roda às 12h (15 UTC) e 18h (21 UTC) de Belém: a partir das 15h de Belém é o 2º lembrete do dia.
  const isSecondReminder = belemNow.getUTCHours() >= 15;
  const dayStartUTC = `${todayStr}T03:00:00.000Z`;
  const dayEndUTCFixed = new Date(new Date(`${todayStr}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

  const { data: users, error: usersError } = await supabase.from("users").select("id, name");
  if (usersError || !users) {
    console.error("Erro ao buscar usuários:", usersError);
    return new Response(JSON.stringify({ error: usersError?.message }), { status: 500 });
  }

  let notified = 0;
  let skippedNoSubscription = 0;
  let subscriptionsRemoved = 0;
  const errors: string[] = [];

  for (const user of users) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (!subs || subs.length === 0) {
      skippedNoSubscription++;
      continue;
    }

    const [visits, groups, studies, classes, pending] = await Promise.all([
      supabase.from("staff_visits").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayStartUTC).lte("created_at", dayEndUTCFixed),
      supabase.from("small_group_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayStartUTC).lte("created_at", dayEndUTCFixed),
      supabase.from("bible_study_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayStartUTC).lte("created_at", dayEndUTCFixed),
      supabase.from("bible_classes").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayStartUTC).lte("created_at", dayEndUTCFixed),
      supabase.from("visit_requests").select("id", { count: "exact", head: true }).eq("assigned_chaplain_id", user.id).eq("status", "assigned"),
    ]);

    const totalToday = (visits.count || 0) + (groups.count || 0) + (studies.count || 0) + (classes.count || 0);
    const pendingCount = pending.count || 0;

    const nothingToday = totalToday === 0;
    // Lembrete final (18h) sem nenhum registro no dia: tom firme.
    const firm = isSecondReminder && nothingToday;

    let body: string;
    if (firm && pendingCount > 0) {
      body = `Último aviso do dia: você ainda não registrou nenhuma atividade hoje, e há ${pendingCount} visita(s) de PG aguardando confirmação.`;
    } else if (firm) {
      body = "Último aviso do dia: você ainda não registrou nenhuma atividade hoje. Lance suas visitas, PGs ou estudos antes de encerrar o expediente.";
    } else if (nothingToday && pendingCount > 0) {
      body = `Você ainda não registrou nenhuma atividade hoje. Também há ${pendingCount} visita(s) de PG aguardando confirmação.`;
    } else if (nothingToday) {
      body = "Você ainda não registrou nenhuma atividade hoje. Não esqueça de lançar suas visitas, PGs ou estudos.";
    } else if (pendingCount > 0) {
      body = `Bom trabalho, ${totalToday} atividade(s) já registrada(s) hoje. Você ainda tem ${pendingCount} visita(s) de PG aguardando confirmação.`;
    } else {
      body = `Bom trabalho! Você já registrou ${totalToday} atividade(s) hoje.`;
    }

    const payload = JSON.stringify({
      title: firm ? "Capelania Pro — lembrete final" : "Capelania Pro",
      body,
      url: "/",
      type: "daily",
      urgency: firm ? "firm" : "normal",
      tag: "daily-reminder",
      badgeCount: pendingCount + (nothingToday ? 1 : 0),
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        notified++;
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          subscriptionsRemoved++;
        } else {
          errors.push(`user=${user.id} status=${statusCode} msg=${err?.message}`);
        }
      }
    }
  }

  const summary = { notified, skippedNoSubscription, subscriptionsRemoved, errors, ranAt: nowUtc.toISOString() };
  console.log("[send-daily-reminders]", JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { status: 200, headers: { "Content-Type": "application/json" } });
});
