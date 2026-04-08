'use client';

import { useMemo } from 'react';

function toDatetimeLocalValue(value: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function LocalDateTimeInput({
  name,
  isoValue,
  className,
}: {
  name: string;
  isoValue: string;
  className?: string;
}) {
  const value = useMemo(() => toDatetimeLocalValue(isoValue), [isoValue]);

  return <input name={name} type="datetime-local" className={className} defaultValue={value} />;
}
