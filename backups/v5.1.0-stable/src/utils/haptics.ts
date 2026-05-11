
/**
 * Utilitário para feedback tátil (vibração) em dispositivos móveis.
 */
export const hapticFeedback = {
  /**
   * Vibração curta para ações de sucesso ou cliques simples.
   */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  /**
   * Vibração média para avisos.
   */
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 30, 15]);
    }
  },

  /**
   * Vibração longa ou padrão de erro.
   */
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }
  },

  /**
   * Vibração para cliques em botões (muito curta).
   */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  }
};
