# RareSignal payments — setup checklist

## Agreed launch configuration
- Provider: Lemon Squeezy (Merchant of Record)
- Monthly: EUR 6.99
- Annual: EUR 69.99 (proposed; equivalent to two months free versus monthly)
- Website: GitHub Pages, static frontend
- Backend: Supabase Free (Auth + Postgres + Edge Functions), subject to free-tier limits
- No paid infrastructure should be enabled without explicit approval.

## Current status
- Pricing page is a non-functional preview.
- No checkout URLs, API keys, webhook secrets or customer data are stored in this repository.
- Premium access is NOT enforced yet. Do not advertise payments as active.
- Annual price must be confirmed before creating the Lemon Squeezy product.
- EUR 6.99 is below the provider's $10 low-price threshold mentioned in its pricing guidance; ask Lemon Squeezy support whether standard fees apply or a custom fee is required before launch.

## Account setup — user action required

### 1. Lemon Squeezy
1. Create an account at https://app.lemonsqueezy.com/register
2. Complete store profile and identity/business verification honestly.
3. Set payout destination to an eligible Croatian bank account.
4. Create a RareSignal store and submit it for activation/review.
5. After activation, create one subscription product named RareSignal Premium with two variants:
   - Monthly — EUR 6.99, billing interval monthly.
   - Annual — EUR 69.99, billing interval yearly (confirm this price first).
6. Set the appropriate digital subscription tax category and review checkout branding, refund policy, support email and terms.
7. Ask Lemon Squeezy support to confirm pricing/fees for a EUR 6.99 subscription (below $10).
8. Never share API keys or signing secrets in chat or commit them to GitHub.

### 2. Supabase
1. Create a free project at https://supabase.com/dashboard
2. Choose a strong database password and save it securely.
3. Select an EU region if available.
4. Enable email authentication; configure allowed redirect URLs for the RareSignal GitHub Pages domain.
5. Do not enable paid add-ons or upgrade plans.

### 3. Secure integration to build after account setup
- Supabase Auth identifies users.
- Checkout session is created server-side using Lemon Squeezy API; never expose the API key in browser JavaScript.
- Pass the authenticated Supabase user ID as checkout custom data.
- A Supabase Edge Function receives Lemon Squeezy webhooks and verifies X-Signature with the signing secret using HMAC SHA-256.
- Store subscription ID, user ID, product/variant ID, status, renewal/cancel timestamps and event IDs in Postgres.
- Make webhook processing idempotent; handle subscription_created, subscription_updated, subscription_cancelled, subscription_resumed, subscription_expired, subscription_payment_failed, subscription_payment_success, subscription_payment_recovered and order_refunded.
- Grant Premium only after verified active/trialing subscription state; revoke or restrict after expiration/refund/past-due policy.
- Protect premium data behind server-side/RLS checks. Hiding buttons in JavaScript is not access control.
- Use Lemon Squeezy customer portal for cancellation/payment updates.
- Test webhooks and checkout before live activation.
- Never store card numbers or payment credentials.

## Required secrets (Supabase Edge Function secrets only)
- LEMONSQUEEZY_API_KEY
- LEMONSQUEEZY_STORE_ID
- LEMONSQUEEZY_WEBHOOK_SECRET
- LEMONSQUEEZY_MONTHLY_VARIANT_ID
- LEMONSQUEEZY_ANNUAL_VARIANT_ID
- Supabase service role key is provided by Supabase runtime; never place it in frontend code.

## Architecture
GitHub Pages is static and cannot securely validate payments. Supabase Edge Functions + Postgres provide the server-side trust boundary. Public catalogue/search can remain public; Premium research and paid signals must be delivered only after server-side entitlement checks.

## Official references
- Pricing and fees: https://www.lemonsqueezy.com/pricing
- Fee details: https://docs.lemonsqueezy.com/help/getting-started/fees
- Supported countries: https://docs.lemonsqueezy.com/help/getting-started/supported-countries
- Payouts: https://docs.lemonsqueezy.com/help/getting-started/getting-paid
- Checkout: https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- Webhooks: https://docs.lemonsqueezy.com/guides/developer-guide/webhooks
- Customer portal: https://docs.lemonsqueezy.com/guides/developer-guide/customer-portal
