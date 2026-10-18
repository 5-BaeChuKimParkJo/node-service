import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ZodError } from 'zod';
import { FastifyReply } from 'fastify';
import { ErrorCode } from '../common';
import { BusinessError } from '../common/business-error';

@Catch(ZodError, BusinessError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError | BusinessError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    if (exception instanceof BusinessError) {
      const statuses = { validation: 400, unauthorized: 401, forbidden: 403, conflict: 409, 'not-found': 404 };
      res.status(statuses[exception.category]).send(exception.response);
      return;
    }

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
