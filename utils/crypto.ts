
export const hashPassword = async (password: string): Promise<string> => {
  if (!password) return "";
  
  // Verificação de segurança: SubtleCrypto exige HTTPS ou Localhost
  if (!window.crypto || !window.crypto.subtle) {
    console.error("ERRO CRÍTICO [Criptografia]: A API 'crypto.subtle' não está disponível. " +
                  "Isso geralmente ocorre porque o site não está usando HTTPS ou não é localhost.");
    return "";
  }

  try {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error("ERRO [Geração de Hash]:", error);
    return "";
  }
};
