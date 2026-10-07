import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Disparada a cada 10 min em dias úteis (ver migration 'schedule_visit_reminder_cron') pra avisar o capelão
// designado ~30 min antes de uma visita de PG que ele tem agendada pra HOJE (visit_requests com
// status='assigned' e scheduled_time preenchido). Mesmo padrão de auth do send-daily-reminders:
// segredo compartilhado simples (x-cron-secret), não JWT de usuário.
//
// v2 (07/10/2026): o payload agora leva type 'visit' + urgency 'firm' (service worker: vibração longa e
// o aviso fica na tela até tocar -- é um compromisso com hora marcada) e `tag` única por visita (um
// aviso nunca substitui o de outra visita).
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

  // "Agora" e "hoje" em horário de Belém (UTC-3, sem horário de verão no Brasil desde 2019) --
  // calculado manualmente em vez de Intl/timezone do Deno, mesmo truque do send-daily-reminders.
  const nowUtc = new Date();
  const belemNow = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const todayStr = belemNow.toISOString().split("T")[0];
  const nowMinutes = belemNow.getUTCHours() * 60 + belemNow.getUTCMinutes();

  const { data: requests, error: reqError } = await supabase
    .from("visit_requests")
    .select("id, pg_name, scheduled_time, assigned_chaplain_id, meeting_location")
    .eq("status", "assigned")
    .eq("date", todayStr)
    .is("reminder_sent_at", null)
    .not("scheduled_time", "is", null)
    .not("assigned_chaplain_id", "is", null);

  if (reqError) {
    console.error("Erro ao buscar visit_requests:", reqError);
    return new Response(JSON.stringify({ error: reqError.message }), { status: 500 });
  }

  // Dispara em QUALQUER tick de cron a partir do momento em que a visita está a 30 minutos ou
  // menos de distância (e ainda não passou) -- janela larga de propósito, pra não depender de o
  // cron rodar exatamente no minuto certo. reminder_sent_at garante que só dispara uma vez.
  const due = (requests || []).filter((r) => {
    const [h, m] = String(r.scheduled_time).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const scheduledMinutes = h * 60 + m;
    const diff = scheduledMinutes - nowMinutes;
    return diff <= 30 && diff > -5;
  });

  let notified = 0;
  let skippedNoSubscription = 0;
  let subscriptionsRemoved = 0;
  const errors: string[] = [];

  for (const r of due) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", r.assigned_chaplain_id);

    if (!subs || subs.length === 0) {
      skippedNoSubscription++;
    } else {
      const local = r.meeting_location ? ` (${r.meeting_location})` : "";
      const payload = JSON.stringify({
        title: "Visita de PG em breve",
        body: `${r.pg_name}${local} às ${r.scheduled_time} -- daqui a pouco.`,
        url: "/",
        type: "visit",
        urgency: "firm",
        tag: `visit-${r.id}`,
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          notified++;
        } catch (err: any) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            subscriptionsRemoved++;
          } else {
            errors.push(`request=${r.id} status=${statusCode} msg=${err?.message}`);
          }
        }
      }
    }

    // Marca como avisado mesmo sem inscrição push ativa -- é "melhor esforço", igual ao lembrete
    // diário; sem isso ficaria reprocessando essa mesma visita a cada 10 min pro resto do dia.
    await supabase.from("visit_requests").update({ reminder_sent_at: nowUtc.toISOString() }).eq("id", r.id);
  }

  const summary = { checked: (requests || []).length, due: due.length, notified, skippedNoSubscription, subscriptionsRemoved, errors, ranAt: nowUtc.toISOString() };
  console.log("[send-visit-reminders]", JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { status: 200, headers: { "Content-Type": "application/json" } });
});
