export function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim().length === 0;
}

export function normalizeText(value: string): string {
  return value.trim();
}
