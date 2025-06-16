import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ZodError } from 'zod';
import { ErrorCode } from '../utils';
import { FastifyReply } from 'fastify';

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();

    const error = exception.errors[0];
    if (!error) {
      res.status(500).send({
        message: '유효성 검사 오류',
      });
    } else {
      res.status(400).send({
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
      });
    }
  }
}
