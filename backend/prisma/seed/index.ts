import { cleanDatabase } from './clean';
import { getPrisma } from './client';
import { seedCore } from './core';
import { assertSeedAllowed } from './guard';
import { seedDashboardDemo } from './portfolio/dashboard';
import { seedExpansionDemo } from './portfolio/expansion';
import { seedFinanceDemo } from './portfolio/finance';
import { seedHrAssetsDemo } from './portfolio/hr-assets';
import { seedLedgerFromOperations } from './portfolio/ledger';
import { seedPosMenu } from './portfolio/menu';
import { seedOperationsDemo } from './portfolio/operations';
import { seedPhaseFeaturesDemo } from './portfolio/phase-features';
import { logSeedSummary } from './summary';

export async function runSeed(): Promise<void> {
  assertSeedAllowed();

  const prisma = getPrisma();
  await cleanDatabase(prisma);

  const ctx = await seedCore(prisma);
  await seedPosMenu(ctx);
  await seedFinanceDemo(ctx);
  await seedHrAssetsDemo(ctx);
  await seedOperationsDemo(ctx);
  await seedExpansionDemo(ctx);
  await seedDashboardDemo(ctx);
  await seedPhaseFeaturesDemo(ctx);
  await seedLedgerFromOperations(ctx);

  logSeedSummary();
}
