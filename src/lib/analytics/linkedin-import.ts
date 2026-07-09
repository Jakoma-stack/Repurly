export type LinkedInAnalyticsImportSummary = {
  fileName: string;
  mimeType?: string;
  byteSize: number;
  importedAt: string;
  format: 'csv' | 'xlsx' | 'unknown';
  sheetNames: string[];
  rowCount: number;
  columns: string[];
  metrics: Record<string, number>;
  topRows: Array<Record<string, string | number | null>>;
  audienceSignals: string[];
  contentSignals: string[];
  warnings: string[];
  textSummary: string;
};

type ParsedTable = {
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, string>>;
};

const MAX_IMPORT_BYTES = Number(process.env.LINKEDIN_ANALYTICS_IMPORT_MAX_BYTES || 8 * 1024 * 1024);
const MAX_ROWS_PER_SHEET = 750;
const MAX_SHEETS = 6;

function normaliseHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim();
}

function normaliseKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseNumeric(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/[^0-9.\-]/g, '')
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function tableFromMatrix(sheetName: string, matrix: unknown[][]): ParsedTable | null {
  const nonEmpty = matrix.filter((row) => row.some((cell) => String(cell ?? '').trim()));
  if (!nonEmpty.length) return null;

  const headerIndex = nonEmpty.findIndex((row) => row.filter((cell) => String(cell ?? '').trim()).length >= 2);
  if (headerIndex === -1) return null;

  const headers = nonEmpty[headerIndex].map((cell, index) => normaliseHeader(String(cell ?? `Column ${index + 1}`)) || `Column ${index + 1}`);
  const rows = nonEmpty.slice(headerIndex + 1, headerIndex + 1 + MAX_ROWS_PER_SHEET).map((row) => {
    const result: Record<string, string> = {};
    headers.forEach((header, index) => {
      result[header] = String(row[index] ?? '').trim();
    });
    return result;
  }).filter((row) => Object.values(row).some(Boolean));

  if (!headers.length || !rows.length) return null;
  return { sheetName, headers, rows };
}

async function parseCsv(file: File): Promise<ParsedTable[]> {
  const text = await file.text();
  const matrix = parseCsvRows(text);
  const table = tableFromMatrix('CSV export', matrix);
  return table ? [table] : [];
}

async function parseXlsx(file: File): Promise<ParsedTable[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbook.SheetNames.slice(0, MAX_SHEETS).map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
    return tableFromMatrix(sheetName, matrix);
  }).filter((table): table is ParsedTable => Boolean(table));
}

function detectFormat(file: File): LinkedInAnalyticsImportSummary['format'] {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  return 'unknown';
}

function metricAliases() {
  return {
    impressions: /impression|view count|views|reach|members reached/i,
    reactions: /reaction|like|likes/i,
    comments: /comment|reply|replies/i,
    reposts: /repost|share|shares/i,
    clicks: /click|clicks|ctr/i,
    engagementRate: /engagement rate|engagement/i,
    followers: /follower|followers gained|new followers/i,
    profileViews: /profile view|profile views|viewer/i,
  } satisfies Record<string, RegExp>;
}

function summariseTables(file: File, tables: ParsedTable[], format: LinkedInAnalyticsImportSummary['format'], warnings: string[]): LinkedInAnalyticsImportSummary {
  const allRows = tables.flatMap((table) => table.rows.map((row) => ({ table: table.sheetName, row })));
  const columns = Array.from(new Set(tables.flatMap((table) => table.headers))).slice(0, 80);
  const aliases = metricAliases();
  const metrics: Record<string, number> = {};

  for (const [metric, matcher] of Object.entries(aliases)) {
    let total = 0;
    let found = false;
    for (const { row } of allRows) {
      for (const [key, value] of Object.entries(row)) {
        if (!matcher.test(key)) continue;
        const numeric = parseNumeric(value);
        if (numeric === null) continue;
        total += numeric;
        found = true;
      }
    }
    if (found) metrics[metric] = Math.round(total * 100) / 100;
  }

  const impressionHeader = columns.find((column) => /impression|view count|views|reach/i.test(column));
  const titleHeader = columns.find((column) => /post title|post|content|text|update|caption/i.test(column));
  const dateHeader = columns.find((column) => /date|time|created|published/i.test(column));
  const commentHeader = columns.find((column) => /comment|reply/i.test(column));

  const topRows = allRows
    .map(({ table, row }) => ({
      table,
      title: titleHeader ? row[titleHeader] || null : null,
      date: dateHeader ? row[dateHeader] || null : null,
      impressions: impressionHeader ? parseNumeric(row[impressionHeader]) ?? 0 : 0,
      comments: commentHeader ? parseNumeric(row[commentHeader]) ?? 0 : 0,
      raw: row,
    }))
    .sort((a, b) => (b.impressions + b.comments * 25) - (a.impressions + a.comments * 25))
    .slice(0, 6)
    .map((item) => ({
      sheet: item.table,
      title: item.title,
      date: item.date,
      impressions: item.impressions || null,
      comments: item.comments || null,
    }));

  const joined = JSON.stringify(allRows.slice(0, 200)).toLowerCase();
  const audienceSignals = [
    /senior|director|cxo|chief|founder|owner|partner/.test(joined) ? 'Audience export includes senior/founder/decision-maker language; treat audience quality as a commercial signal.' : null,
    /hospital|health|nhs|care/.test(joined) ? 'Healthcare/health and care audience signal detected.' : null,
    /it services|consulting|technology|software|saas/.test(joined) ? 'IT services/technology/consulting audience signal detected.' : null,
    /location|country|region|city/.test(columns.map(normaliseKey).join(' ')) ? 'Location/demographic columns detected.' : null,
  ].filter(Boolean) as string[];

  const contentSignals = [
    metrics.impressions ? `${metrics.impressions.toLocaleString('en-GB')} total impressions/views detected across imported rows.` : null,
    metrics.comments ? `${metrics.comments.toLocaleString('en-GB')} comments/replies detected; use these to identify content that started conversation.` : null,
    metrics.profileViews ? `${metrics.profileViews.toLocaleString('en-GB')} profile views detected; useful as awareness, not enough for DM by itself.` : null,
    topRows.length ? `Top imported row: ${String(topRows[0].title ?? 'untitled post')} (${topRows[0].impressions ?? 'unknown'} impressions/views).` : null,
  ].filter(Boolean) as string[];

  if (!tables.length) warnings.push('No usable tabular data was detected in the uploaded file.');
  if (format === 'unknown') warnings.push('Unknown file format. Accepted formats are .csv, .xlsx and .xls.');

  const metricLines = Object.entries(metrics).map(([key, value]) => `- ${key}: ${value.toLocaleString('en-GB')}`);
  const topLines = topRows.map((row, index) => `- ${index + 1}. ${row.title ?? 'Untitled row'}${row.date ? ` (${row.date})` : ''}${row.impressions ? ` — ${row.impressions} impressions/views` : ''}${row.comments ? `, ${row.comments} comments` : ''}`);
  const textSummary = [
    `Imported LinkedIn analytics export: ${file.name}`,
    `Format: ${format.toUpperCase()} · Sheets/tables: ${tables.map((table) => table.sheetName).join(', ') || 'none'} · Rows parsed: ${allRows.length}`,
    metricLines.length ? `Detected metrics:\n${metricLines.join('\n')}` : 'No standard LinkedIn metric columns were confidently detected.',
    audienceSignals.length ? `Audience signals:\n${audienceSignals.map((item) => `- ${item}`).join('\n')}` : 'No clear audience demographic signals detected in the import.',
    topLines.length ? `Top rows/posts:\n${topLines.join('\n')}` : 'No post-level rows were ranked from the import.',
    warnings.length ? `Import warnings:\n${warnings.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    fileName: file.name,
    mimeType: file.type || undefined,
    byteSize: file.size,
    importedAt: new Date().toISOString(),
    format,
    sheetNames: tables.map((table) => table.sheetName),
    rowCount: allRows.length,
    columns,
    metrics,
    topRows,
    audienceSignals,
    contentSignals,
    warnings,
    textSummary,
  };
}

export async function parseLinkedInAnalyticsImport(file: File | null | undefined): Promise<LinkedInAnalyticsImportSummary | null> {
  if (!file || file.size === 0) return null;
  const warnings: string[] = [];
  const format = detectFormat(file);

  if (file.size > MAX_IMPORT_BYTES) {
    return summariseTables(file, [], format, [`File is larger than the ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB beta import limit.`]);
  }

  let tables: ParsedTable[] = [];
  try {
    if (format === 'csv') tables = await parseCsv(file);
    if (format === 'xlsx') tables = await parseXlsx(file);
  } catch (error) {
    warnings.push(`Could not parse import: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  return summariseTables(file, tables, format, warnings);
}
