export function isValidExcelFile(filename: string): boolean {
  const extensions = [".xlsx", ".xls", ".ods", ".csv"];
  const lowerFilename = filename.toLowerCase();
  return extensions.some(ext => lowerFilename.endsWith(ext));
}

export function isValidYear(year: number): boolean {
  return year >= 2015 && year <= new Date().getFullYear() + 2;
}

export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, " ");
}

export function parseNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[=()Qq,]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function jaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.toLowerCase().split(/\s+/));
  const set2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}
