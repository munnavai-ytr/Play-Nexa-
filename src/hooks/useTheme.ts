'use client';

import { useState, useCallback } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'amoled' | 'neon'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('grovix_theme') as 'dark' | 'amoled' | 'neon') || 'dark';
    }
    return 'dark';
  });

  const changeTheme = useCallback((newTheme: 'dark' | 'amoled' | 'neon') => {
    setTheme(newTheme);
    localStorage.setItem('grovix_theme', newTheme);
  }, []);

  return { theme, changeTheme };
}
