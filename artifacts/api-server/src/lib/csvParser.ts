import { parse } from "csv-parse/sync";

export function parseCsvBuffer(buffer: Buffer): Record<string, string>[] {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  return records;
}
