type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

export function isInvestorSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as DatabaseErrorLike;
  const text = `${value.message ?? ''} ${value.details ?? ''}`.toLowerCase();
  return value.code === 'PGRST204'
    || value.code === 'PGRST205'
    || value.code === '42703'
    || value.code === '42P01'
    || text.includes('could not find the') && (text.includes('column') || text.includes('relation'))
    || text.includes('does not exist') && (text.includes('column') || text.includes('relation'))
    || text.includes('schema cache') && (text.includes('column') || text.includes('table'));
}
