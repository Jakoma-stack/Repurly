import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in' as Route);
  return userId;
}