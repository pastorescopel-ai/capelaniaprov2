import { useState, useEffect } from 'react';

export const useKeyboardDetection = () => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Fallback para detecção baseada em foco
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isNotSpecial = !['checkbox', 'radio', 'range', 'button', 'submit', 'file'].includes((target as HTMLInputElement).type);
      
      if (isInput && isNotSpecial) {
        setIsKeyboardOpen(true);
      }
    };
    const handleBlur = () => setIsKeyboardOpen(false);

    // Detecção moderna baseada em VisualViewport (mais precisa para teclado real)
    const handleViewportChange = () => {
      if (window.visualViewport) {
        // Se a altura do viewport diminuiu significativamente em relação à tela, o teclado provavelmente está aberto
        const isLikelyKeyboard = window.visualViewport.height < window.innerHeight * 0.85;
        setIsKeyboardOpen(isLikelyKeyboard);
      }
    };

    window.addEventListener('focusin', handleFocus);
    window.addEventListener('focusout', handleBlur);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    return () => {
      window.removeEventListener('focusin', handleFocus);
      window.removeEventListener('focusout', handleBlur);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  return isKeyboardOpen;
};
