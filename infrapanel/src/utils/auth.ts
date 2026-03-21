import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie, deleteCookie } from 'vinxi/http';
import { z } from 'zod';

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const session = getCookie('infrapanel_session');
  return session === 'authenticated';
});

export const login = createServerFn({ method: "POST" })
  .inputValidator(z.string())
  .handler(async ({ data }) => {
    const password = data;
    // A Panel jelszó env változóból jön, vagy default 'admin123' dev módban
    const validPassword = process.env.PANEL_ADMIN_PASSWORD || 'admin123';
    
    if (password === validPassword) {
      setCookie('infrapanel_session', 'authenticated', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 hét
        sameSite: 'lax'
      });
      return { success: true };
    }
    return { success: false, error: 'Hibás jelszó' };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie('infrapanel_session');
  return { success: true };
});
