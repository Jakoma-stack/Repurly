'use client';

import { useMemo } from 'react';

function formatLocalDateTime(value: string | null) {
  if (!value) {
    return 'Not scheduled';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function LocalDateTime({ value, fallback = 'Not scheduled' }: { value: string | null; fallback?: string }) {
  const label = useMemo(() => {
    if (!value) return fallback;
    return formatLocalDateTime(value);
  }, [fallback, value]);

  return <>{label}</>;
}
