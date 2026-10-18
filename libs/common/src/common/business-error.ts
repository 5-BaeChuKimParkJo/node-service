export type ErrorCategory = 'validation' | 'unauthorized' | 'forbidden' | 'conflict' | 'not-found';

export class BusinessError extends Error {
  constructor(
    readonly response: { message: string; code: number },
    readonly category: ErrorCategory,
  ) {
    super(response.message);
    this.name = 'BusinessError';
  }
}
