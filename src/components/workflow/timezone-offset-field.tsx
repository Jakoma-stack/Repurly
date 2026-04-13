'use client';

import { useEffect, useState } from 'react';

export function TimezoneOffsetField({ name = 'timezoneOffsetMinutes' }: { name?: string }) {
  const [value, setValue] = useState('0');

  useEffect(() => {
    setValue(String(new Date().getTimezoneOffset()));
  }, []);

  return <input type="hidden" name={name} value={value} />;
}
