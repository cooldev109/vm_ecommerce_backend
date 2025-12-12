-- Mark an order as PAID for invoice testing
-- Replace 'YOUR_ORDER_ID' with the actual order ID

-- View current order status
SELECT
  id,
  "firstName",
  "lastName",
  status,
  "paymentStatus",
  total,
  "createdAt"
FROM "Order"
ORDER BY "createdAt" DESC
LIMIT 5;

-- Update order to PAID status
-- UPDATE "Order"
-- SET
--   "paymentStatus" = 'PAID',
--   "paymentMethod" = 'WEBPAY',
--   "paymentDate" = NOW()
-- WHERE id = 'YOUR_ORDER_ID';

-- Verify the update
-- SELECT id, status, "paymentStatus", "paymentDate"
-- FROM "Order"
-- WHERE id = 'YOUR_ORDER_ID';
