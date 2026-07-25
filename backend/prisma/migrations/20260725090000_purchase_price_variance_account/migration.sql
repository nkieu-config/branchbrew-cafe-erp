INSERT INTO "Account" ("code", "name", "type", "description", "isActive", "createdAt", "updatedAt")
VALUES (
  '5035',
  'Purchase Price Variance',
  'EXPENSE',
  'Difference between purchase order cost and ingredient standard cost on goods receipt',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
