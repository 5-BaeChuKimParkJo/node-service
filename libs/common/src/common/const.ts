export const ErrorCode = {
  VALIDATION_ERROR: 1000,
  FORBIDDEN_ADMIN_REQUIRED: 1001,
  INTERNAL_VALIDATION_ERROR: 1002,
  UNAUTHORIZED: 1003,
  INVALID_EXTENSION: 1004,
  FILE_NOT_FOUND: 1005,
  NOT_FOUND: 1006,
  DB_ERROR: 1007,
  OTHER_SERVICE_ERROR: 1008,
  KAFKA_COMMIT_ERROR: 1009,
} satisfies Record<string, number>;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
