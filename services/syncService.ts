
/**
 * SYNC SERVICE - LEGACY BRIDGE
 * Faz a ponte com o Google Script URL.
 */
export const SyncService = {
  async fetchFromSheets(url: string) {
    try {
      const response = await fetch(`${url}?action=getData`);
      if (!response.ok) throw new Error("Erro na rede Sheets");
      return await response.json();
    } catch (e) {
      console.error("SyncService Error:", e);
      return null;
    }
  },
  
  async pushToSheets(url: string, data: any) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (e) {
      console.error("Push error:", e);
      return { success: false };
    }
  }
};
