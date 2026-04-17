'use client';

export function TimezoneOffsetField({ name = 'timezoneOffsetMinutes' }: { name?: string }) {
  const value = String(new Date().getTimezoneOffset());
  return <input type="hidden" name={name} value={value} />;
}
