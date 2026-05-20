import { BadRequestException, Logger } from '@nestjs/common';

export class IntegrationException extends BadRequestException {
  private static readonly logger = new Logger('IntegrationException');

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'IntegrationException';
    if (cause) {
      IntegrationException.logger.error(`Integration Error: ${cause.message}`, cause.stack);
    }
  }
}
