'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { brands } from '../../../drizzle/schema';

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function slugify(value: string) {
  return (value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'brand');
}

function parseHashtags(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((item) => item.replace(/^#/, '').trim())
    .filter(Boolean);
}

function parseCsv(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function refreshBrandPages() {
  revalidatePath('/app');
  revalidatePath('/app/brands');
  revalidatePath('/app/content');
  revalidatePath('/app/leads');
  revalidatePath('/app/engagement');
}

export async function saveBrand(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = requiredString(formData, 'brandId');
  const name = requiredString(formData, 'name');

  if (!workspaceId || !name) {
    redirect('/app/brands?error=invalid' as Route);
  }

  const values = {
    workspaceId,
    name,
    slug: slugify(requiredString(formData, 'slug') || name),
    status: requiredString(formData, 'status') || 'active',
    website: requiredString(formData, 'website') || null,
    contactEmail: requiredString(formData, 'contactEmail') || null,
    defaultTone: requiredString(formData, 'defaultTone') || null,
    audience: requiredString(formData, 'audience') || null,
    primaryCta: requiredString(formData, 'primaryCta') || null,
    secondaryCta: requiredString(formData, 'secondaryCta') || null,
    hashtags: parseHashtags(requiredString(formData, 'hashtags')),
    linkedinProfileUrl: requiredString(formData, 'linkedinProfileUrl') || null,
    linkedinCompanyUrl: requiredString(formData, 'linkedinCompanyUrl') || null,
    metadata: {
      aiProfile: {
        voiceNotes: requiredString(formData, 'voiceNotes') || null,
        blockedTerms: parseCsv(requiredString(formData, 'blockedTerms')).join(', '),
        proofPoints: requiredString(formData, 'proofPoints') || null,
        complianceRules: parseCsv(requiredString(formData, 'complianceRules')).join(', '),
      },
    },
    updatedAt: new Date(),
  };

  if (brandId) {
    await db
      .update(brands)
      .set(values)
      .where(and(eq(brands.id, brandId), eq(brands.workspaceId, workspaceId)));
  } else {
    await db.insert(brands).values(values);
  }

  await refreshBrandPages();
  redirect('/app/brands?ok=saved' as Route);
}

export async function archiveBrand(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = requiredString(formData, 'brandId');
  if (!workspaceId || !brandId) redirect('/app/brands?error=invalid' as Route);

  await db
    .update(brands)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, workspaceId)));

  await refreshBrandPages();
  redirect('/app/brands?ok=archived' as Route);
}

export async function restoreBrand(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = requiredString(formData, 'brandId');
  if (!workspaceId || !brandId) redirect('/app/brands?error=invalid' as Route);

  await db
    .update(brands)
    .set({ status: 'active', updatedAt: new Date() })
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, workspaceId)));

  await refreshBrandPages();
  redirect('/app/brands?ok=restored' as Route);
}
