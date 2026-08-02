import { ConflictException, ForbiddenException } from '@nestjs/common';
import { HrService } from './hr.service';
import type { BranchScopedUser } from '../auth/branch-scope.util';

describe('HrService.processLeaveRequestsBulk', () => {
  const user = { userId: 1, role: 'MANAGER', branchId: 1 } as BranchScopedUser;

  function serviceWith(processOne: jest.Mock): HrService {
    const service = Object.create(HrService.prototype) as HrService;
    (
      service as unknown as { processLeaveRequest: jest.Mock }
    ).processLeaveRequest = processOne;
    return service;
  }

  it('reports every id as succeeded when all decisions land', async () => {
    const processOne = jest.fn().mockResolvedValue({});
    const result = await serviceWith(processOne).processLeaveRequestsBulk(
      [1, 2, 3],
      'APPROVED',
      user,
    );

    expect(result).toEqual({ requested: 3, succeeded: [1, 2, 3], failed: [] });
    expect(processOne).toHaveBeenCalledTimes(3);
  });

  it('keeps processing after a failure instead of aborting the batch', async () => {
    const processOne = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new ConflictException('Leave request has already been decided.'),
      )
      .mockResolvedValueOnce({});

    const result = await serviceWith(processOne).processLeaveRequestsBulk(
      [1, 2, 3],
      'APPROVED',
      user,
    );

    expect(result.succeeded).toEqual([1, 3]);
    expect(result.failed).toEqual([
      { id: 2, reason: 'Leave request has already been decided.' },
    ]);
    expect(processOne).toHaveBeenCalledTimes(3);
  });

  it('surfaces an access failure as a per-item reason, not a batch crash', async () => {
    const processOne = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('You do not have access.'));

    const result = await serviceWith(processOne).processLeaveRequestsBulk(
      [7],
      'REJECTED',
      user,
    );

    expect(result.succeeded).toEqual([]);
    expect(result.failed[0].reason).toBe('You do not have access.');
  });

  it('does not hide a non-HTTP failure behind its internal message', async () => {
    const processOne = jest
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    const result = await serviceWith(processOne).processLeaveRequestsBulk(
      [9],
      'APPROVED',
      user,
    );

    expect(result.failed).toEqual([
      { id: 9, reason: 'Could not be processed' },
    ]);
  });

  it('deduplicates ids so a repeated id is decided once', async () => {
    const processOne = jest.fn().mockResolvedValue({});
    const result = await serviceWith(processOne).processLeaveRequestsBulk(
      [4, 4, 5],
      'APPROVED',
      user,
    );

    expect(result.requested).toBe(2);
    expect(processOne).toHaveBeenCalledTimes(2);
  });
});
