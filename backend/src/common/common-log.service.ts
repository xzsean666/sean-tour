import { LoggerService } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { join } from 'path';
import {
  createLogger,
  format,
  transports,
  type Logger,
  type transport,
} from 'winston';
import GelfTransport from 'winston-gelf';
import { config } from '../config/index';

export class CommonLogger implements LoggerService {
  private logger: Logger;

  constructor() {
    const logDirectory = join(process.cwd(), 'logs');
    mkdirSync(logDirectory, { recursive: true });

    const GraylogTransport = GelfTransport as unknown as new (options: {
      gelfPro: {
        fields: {
          facility: string;
        };
        adapterName: 'udp';
        adapterOptions: {
          host: string;
          port: number;
        };
        environment: string;
        version: string;
      };
    }) => transport;

    const logTransports: transport[] = [
      new transports.File({
        filename: join(logDirectory, 'error.log'),
        level: 'error',
      }),
      new transports.File({
        filename: join(logDirectory, 'combined.log'),
      }),
    ];

    if (config.GRAYLOG_HOST) {
      const graylogTransport = new GraylogTransport({
        gelfPro: {
          fields: {
            facility: `${config.PROJECT_NAME ?? ''}${config.PUBLIC_IP ? `_${config.PUBLIC_IP}` : ''}`,
          },
          adapterName: 'udp',
          adapterOptions: {
            host: config.GRAYLOG_HOST,
            port: config.GRAYLOG_PORT,
          },
          environment: config.NODE_ENV,
          version: '1.0',
        },
      }) as unknown as transport;

      logTransports.push(graylogTransport);
    }

    this.logger = createLogger({
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      format: format.combine(format.timestamp(), format.json()),
      transports: logTransports,
    });

    if (config.NODE_ENV !== 'production') {
      this.logger.add(
        new transports.Console({
          format: format.combine(format.colorize(), format.simple()),
        }),
      );
    }
  }

  log(message: string) {
    this.logger.info(message);
  }

  error(message: string, trace?: string) {
    this.logger.error(message, { trace });
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
