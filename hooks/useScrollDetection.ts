import { useState, useEffect } from 'react';

export const useScrollDetection = (elementId: string, threshold: number = 40) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = document.getElementById(elementId);
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollTop > threshold);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [elementId, threshold]);

  return isScrolled;
};
