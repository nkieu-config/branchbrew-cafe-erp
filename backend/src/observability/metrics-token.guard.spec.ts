import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { MetricsTokenGuard } from './metrics-token.guard';

describe('MetricsTokenGuard', () => {
  const guard = new MetricsTokenGuard();
  const TOKEN = 'a-metrics-token-that-is-long-enough-32';

  const contextWith = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: authorization ? { authorization } : {} }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  it('hides the endpoint entirely when no token is configured', () => {
    expect(() => guard.canActivate(contextWith(`Bearer ${TOKEN}`))).toThrow(
      NotFoundException,
    );
  });

  it('rejects a request with no credentials', () => {
    process.env.METRICS_TOKEN = TOKEN;

    expect(() => guard.canActivate(contextWith())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong token', () => {
    process.env.METRICS_TOKEN = TOKEN;

    expect(() =>
      guard.canActivate(contextWith('Bearer not-the-right-token')),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token sent without the Bearer scheme', () => {
    process.env.METRICS_TOKEN = TOKEN;

    expect(() => guard.canActivate(contextWith(TOKEN))).toThrow(
      UnauthorizedException,
    );
  });

  it('admits the configured token', () => {
    process.env.METRICS_TOKEN = TOKEN;

    expect(guard.canActivate(contextWith(`Bearer ${TOKEN}`))).toBe(true);
  });
});
