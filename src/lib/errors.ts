export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
};

export const isRejectedTransaction = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code: unknown }).code
    : undefined;

  return code === 'ACTION_REJECTED' || message.includes('user rejected action');
};
