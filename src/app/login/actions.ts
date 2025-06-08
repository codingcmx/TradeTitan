
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation'; // Import redirect

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
    redirect('/'); // Perform redirect from server action
    // The code below will not be reached if redirect is successful.
  } else {
    return { error: 'Invalid password.' };
  }
}

export async function logoutAction() {
  cookies().delete('auth_token');
  redirect('/login');
}
