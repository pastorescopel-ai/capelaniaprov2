export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
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
