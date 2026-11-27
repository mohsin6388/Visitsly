export const FILE_TOO_LARGE_MESSAGE = 'The file is too large for the server. Please upload a smaller file or contact support.';

/**
 * Readable reason for a failed upload (or any request). Never relies only on response.data.message:
 * a proxy such as nginx answers 413 with an HTML page, so `data` may be a string.
 */
export function uploadErrorMessage(error, fallback = 'Upload failed. Please try again.') {
  if (error?.response?.status === 413) return FILE_TOO_LARGE_MESSAGE;
  const data = error?.response?.data;
  if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) return data.message;
  // HTML / plain-text bodies (proxy error pages) are not shown to the user.
  if (!error?.response && (error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message)))) return 'The upload took too long. Check your connection or try a smaller file.';
  if (!error?.response && error?.request) return 'Could not reach the server. Check your connection and try again.';
  return fallback;
}
