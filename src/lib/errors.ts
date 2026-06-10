export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (typeof error === 'string') return error;

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const candidates = [
      record.shortMessage,
      record.details,
      record.reason,
      record.error,
      record.data,
      record.cause,
    ];

    for (const candidate of candidates) {
      const message = getNestedErrorMessage(candidate);
      if (message) return message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown wallet or network error.";
    }
  }

  return String(error);
};

const getNestedErrorMessage = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  for (const key of ['message', 'shortMessage', 'details', 'reason']) {
    const nested = record[key];
    if (typeof nested === 'string' && nested.length > 0) return nested;
  }

  for (const key of ['error', 'data', 'cause']) {
    const nested = getNestedErrorMessage(record[key]);
    if (nested) return nested;
  }

  return null;
};

export const isRejectedTransaction = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code: unknown }).code
    : undefined;

  return code === 'ACTION_REJECTED' || message.includes('user rejected action');
};
