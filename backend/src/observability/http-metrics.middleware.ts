import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

function routeLabel(req: Request): string {
  const routed = req as unknown as { route?: { path?: unknown } };
  const path = routed.route?.path;
  return typeof path === 'string' ? path : 'unmatched';
}

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const elapsedNs = Number(process.hrtime.bigint() - startedAt);

      this.metrics.recordRequest(
        req.method,
        routeLabel(req),
        res.statusCode,
        elapsedNs / 1e9,
      );
    });

    next();
  }
}
