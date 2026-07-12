// Limitador simples em memória — melhor esforço em funções serverless (não garante persistência
// entre instâncias/regiões diferentes, mas barra abuso repetido na mesma instância "quente").
const rateLimitHits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 10;
const WINDOW_MS = 60_000;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = rateLimitHits.get(clientIp);
  if (!entry || now > entry.resetAt) {
    rateLimitHits.set(clientIp, { count: 1, resetAt: now + WINDOW_MS });
  } else if (entry.count >= MAX_REQUESTS) {
    return res.status(429).json({ success: false, error: "Muitas requisições. Tente novamente em instantes." });
  } else {
    entry.count++;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn("⚠️ AVISO: TURNSTILE_SECRET_KEY não configurada no servidor!");
    return res.status(500).json({ success: false, error: "Verificação de segurança não configurada." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const token = body?.token;

  if (!token) {
    return res.status(400).json({ success: false, error: "Token ausente." });
  }

  try {
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: req.headers["x-forwarded-for"] || "",
      }),
    });
    const outcome = await verifyResponse.json();
    res.status(200).json({ success: !!outcome.success });
  } catch (e) {
    console.error("Erro ao verificar Turnstile:", e);
    res.status(500).json({ success: false, error: "Falha ao contatar o Cloudflare." });
  }
}
