const SUCCESS_CODES = new Set(["FINISHED", "PUBLISHED"]);
const FAILURE_CODES = new Set(["ERROR", "EXPIRED"]);
const IN_PROGRESS_CODES = new Set(["IN_PROGRESS", "PENDING", "PROCESSING", "SCHEDULED"]);

export type InstagramContainerStatus = {
  id: string;
  statusCode: string;
  status?: string;
  errorMessage?: string;
  statusDetails?: string;
  isReady: boolean;
  isFailure: boolean;
  isInProgress: boolean;
};

export function normalizeInstagramContainerStatus(payload: {
  id: string;
  status_code?: string;
  status?: string;
  error_message?: string;
  status_details?: string;
}): InstagramContainerStatus {
  const statusCode = (payload.status_code ?? payload.status ?? "UNKNOWN").toUpperCase();
  return {
    id: payload.id,
    statusCode,
    status: payload.status,
    errorMessage: payload.error_message,
    statusDetails: payload.status_details,
    isReady: SUCCESS_CODES.has(statusCode),
    isFailure: FAILURE_CODES.has(statusCode),
    isInProgress: IN_PROGRESS_CODES.has(statusCode),
  };
}

export function formatInstagramStatusMessage(status: InstagramContainerStatus): string {
  if (status.isReady) return "Instagram media is ready to publish.";
  if (status.isFailure) {
    return status.errorMessage || status.statusDetails || "Instagram rejected or failed to process this media container.";
  }
  if (status.isInProgress) {
    return "Instagram is still processing this media container.";
  }
  return status.errorMessage || status.statusDetails || `Instagram returned status ${status.statusCode}.`;
}
