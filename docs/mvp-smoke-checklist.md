# MVP Smoke Checklist

This checklist is for a quick pre-release manual validation of the MVP flow:
`login -> booking -> payment callback -> order detail`.

## 1. Prerequisites

1. Backend env configured:
   - `backend/.env` contains:
     - `JWT_SECRET`
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `ADMIN_AUTH_CODE`
     - `PAYMENT_CALLBACK_SECRET`
2. Frontend env configured:
   - `frontend/.env` contains:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_BACKEND_GRAPHQL_URL=http://localhost:3000/graphql`
     - `VITE_BACKEND_ADMIN_AUTH_CODE` (same value as backend `ADMIN_AUTH_CODE`)

## 2. Start Services

```bash
pnpm --dir backend start:dev
pnpm --dir frontend dev
```

## 3. Login And Create Booking

1. Open `http://localhost:5173`.
2. Login with a valid user.
3. On services page, click `Book Now` for any service.
4. Confirm you are redirected to `/checkout/:bookingId`.
5. Record:
   - `bookingId` (from URL)
   - `expectedAmount` (shown on checkout page)

## 4. Trigger Signed Callback (PAID)

Export variables:

```bash
export ADMIN_AUTH_CODE='your-admin-auth-code'
export PAYMENT_CALLBACK_SECRET='your-payment-callback-secret'
export BOOKING_ID='bk_xxx'
export EXPECTED_AMOUNT='100.00'
export EVENT_ID="evt_smoke_$(date +%s)"
export TX_HASH='0xsmoketest123'
export CONFIRMATIONS='12'
```

Generate signature (same rule as backend):

```bash
export SIGNATURE=$(node -e "const c=require('crypto');const p=[process.env.EVENT_ID,'',process.env.BOOKING_ID,'PAID',process.env.EXPECTED_AMOUNT,process.env.TX_HASH,process.env.CONFIRMATIONS].join('|');process.stdout.write(c.createHmac('sha256',process.env.PAYMENT_CALLBACK_SECRET).update(p).digest('hex'));")
```

Send callback:

```bash
curl -X POST 'http://localhost:3000/payment/callback/usdt' \
  -H 'Content-Type: application/json' \
  -H "admin_auth_code: ${ADMIN_AUTH_CODE}" \
  -d "{
    \"bookingId\": \"${BOOKING_ID}\",
    \"status\": \"PAID\",
    \"paidAmount\": \"${EXPECTED_AMOUNT}\",
    \"txHash\": \"${TX_HASH}\",
    \"confirmations\": ${CONFIRMATIONS},
    \"eventId\": \"${EVENT_ID}\",
    \"signature\": \"${SIGNATURE}\"
  }"
```

Expected response:
- HTTP `201`
- body `status = PAID`

## 5. Verify Frontend Result

1. Back to frontend checkout page.
2. Wait for polling (up to ~15s).
3. Confirm auto jump to order detail page.
4. On order detail:
   - `paymentStatus = PAID`
   - payment event timeline contains `eventId = $EVENT_ID`
   - source shows `CALLBACK`

## 6. Verify Admin Payment Observability

1. Open `/admin/payments`.
2. Filter by:
   - `Event ID = $EVENT_ID`, or
   - `Actor = callback_webhook`
3. Confirm event exists and fields are correct (`status/paidAmount/txHash/confirmations`).

## 7. Quick Negative Checks

1. Remove `admin_auth_code` header and retry callback:
   - expected: unauthorized error.
2. Keep header but set wrong `signature`:
   - expected: `Invalid callback signature`.
