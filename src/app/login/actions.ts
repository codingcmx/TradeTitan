
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function loginAction(password: string): Promise<{ error?: string } | void> {
  const appPassword = process.env.APP_PASSWORD;
  const authCookieValue = process.env.AUTH_COOKIE_VALUE;

  if (!appPassword || !authCookieValue) {
    console.error('APP_PASSWORD or AUTH_COOKIE_VALUE is not set in environment variables.');
    return { error: 'Server configuration error. Please contact administrator.' };
  }

  if (password === appPassword) {
    cookies().set('auth_token', authCookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    // Redirect will be handled by middleware mostly, but can force here if needed.
    // For now, let middleware handle redirect after cookie is set.
    // The client-side form submission will also attempt a redirect.
    return; // Indicate success (no error)
  } else {
    return { error: 'Invalid password.' };
  }
}

export async function logoutAction() {
  cookies().delete('auth_token');
  redirect('/login');
}
