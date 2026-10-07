import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// [BACKUP da versão 4, de antes de 07/10/2026] Disparada 2x/dia (12h e 18h horário de Belém) via pg_cron + pg_net.
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

    let body: string;
    if (totalToday === 0 && pendingCount > 0) {
      body = `Você ainda não registrou nenhuma atividade hoje. Também há ${pendingCount} visita(s) de PG aguardando confirmação.`;
    } else if (totalToday === 0) {
      body = "Você ainda não registrou nenhuma atividade hoje. Não esqueça de lançar suas visitas, PGs ou estudos.";
    } else if (pendingCount > 0) {
      body = `Bom trabalho, ${totalToday} atividade(s) já registrada(s) hoje. Você ainda tem ${pendingCount} visita(s) de PG aguardando confirmação.`;
    } else {
      body = `Bom trabalho! Você já registrou ${totalToday} atividade(s) hoje.`;
    }

    const payload = JSON.stringify({ title: "Capelania Pro", body, url: "/" });

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
