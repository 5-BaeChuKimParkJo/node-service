import { ArgumentsHost } from '@nestjs/common';
import { z } from 'zod';
import { BusinessError, ErrorCategory } from '../common/business-error';
import { ErrorCode } from '../common/const';
import { ZodExceptionFilter } from './zod-exception.filter';

function response() {
  const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => reply }) } as unknown as ArgumentsHost;
  return { reply, host };
}

describe('ZodExceptionFilter domain error mapping', () => {
  it.each<[ErrorCategory, number]>([
    ['validation', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['conflict', 409],
    ['not-found', 404],
  ])('preserves the %s error response with HTTP %i', (category, status) => {
    const { reply, host } = response();
    const body = { code: ErrorCode.VALIDATION_ERROR, message: 'Rejected bid' };
    new ZodExceptionFilter().catch(new BusinessError(body, category), host);
    expect(reply.status).toHaveBeenCalledWith(status);
    expect(reply.send).toHaveBeenCalledWith(body);
  });

  it('preserves the first schema validation message and error code', () => {
    const { reply, host } = response();
    const parsed = z.string().min(5, 'Too short').safeParse('x');
    if (parsed.success) throw new Error('Invalid fixture');
    new ZodExceptionFilter().catch(parsed.error, host);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ code: ErrorCode.VALIDATION_ERROR, message: 'Too short' });
  });
});
