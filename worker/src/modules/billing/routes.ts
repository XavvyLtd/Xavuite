/**
 * modules/billing/routes.ts
 * Stripe billing: checkout sessions, portal, webhook handler.
 */

import { ok, created, err } from '../../core/response';
import type { Env, AppContext } from '../../types';

const PLAN_PRICES: Record<string, Record<string, string>> = {
  starter:      { monthly: 'price_starter_monthly',      annual: 'price_starter_annual' },
  professional: { monthly: 'price_professional_monthly', annual: 'price_professional_annual' },
  enterprise:   { monthly: 'price_enterprise_monthly',   annual: 'price_enterprise_annual' },
};

export async function handleBilling(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [action] = subPath.split('/').filter(Boolean);

  // GET /api/billing/subscription — current subscription info
  if (action === 'subscription' && request.method === 'GET') {
    const sub = await env.DB.prepare(`
      SELECT s.*, t.name AS company_name,
             (SELECT COUNT(*) FROM employees WHERE tenant_id=s.tenant_id AND status='active') AS employee_count
      FROM subscriptions s
      JOIN tenants t ON t.id=s.tenant_id
      WHERE s.tenant_id=?
    `).bind(ctx.tenantId).first();
    return ok(sub ?? { plan:'free', status:'active', seat_count:5 });
  }

  // POST /api/billing/checkout — create Stripe checkout session
  if (action === 'checkout' && request.method === 'POST') {
    if (!env.STRIPE_SECRET_KEY) return err('Stripe not configured');
    const { plan, interval = 'monthly', seats = 5 } = await request.json() as any;
    if (!plan || !PLAN_PRICES[plan]) return err('Invalid plan');

    const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
    const priceId = (env as any)[envKey] ?? PLAN_PRICES[plan][interval];

    const platformUrl = `https://${env.TENANT_DOMAIN ?? 'api-v2.xavvy.uk'}`;

    // Get or create Stripe customer
    let sub = await env.DB.prepare(`SELECT * FROM subscriptions WHERE tenant_id=?`).bind(ctx.tenantId).first() as any;
    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
      const user = await env.DB.prepare(`SELECT email FROM users WHERE id=?`).bind(ctx.userId).first() as any;
      const tenant = await env.DB.prepare(`SELECT name FROM tenants WHERE id=?`).bind(ctx.tenantId).first() as any;

      const custRes = await stripeRequest(env, 'POST', '/v1/customers', {
        email: user?.email,
        name:  tenant?.name,
        metadata: { tenantId: ctx.tenantId },
      });
      const cust = await custRes.json() as any;
      customerId = cust.id;

      // Save customer ID
      await env.DB.prepare(`
        INSERT INTO subscriptions (id,tenant_id,plan,status,stripe_customer_id,seat_count)
        VALUES (?,?,'free','active',?,?)
        ON CONFLICT(tenant_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id
      `).bind(crypto.randomUUID(), ctx.tenantId, customerId, seats).run();
    }

    // Create checkout session
    const sessionRes = await stripeRequest(env, 'POST', '/v1/checkout/sessions', {
      customer:             customerId,
      mode:                 'subscription',
      line_items:           [{ price: priceId, quantity: seats }],
      success_url:          `${platformUrl}/settings?tab=billing&success=1`,
      cancel_url:           `${platformUrl}/settings?tab=billing`,
      subscription_data:    { metadata: { tenantId: ctx.tenantId } },
      allow_promotion_codes:true,
    });
    const session = await sessionRes.json() as any;
    if (session.error) return err(session.error.message ?? 'Stripe error');

    return ok({ url: session.url, sessionId: session.id });
  }

  // POST /api/billing/portal — create Stripe customer portal session
  if (action === 'portal' && request.method === 'POST') {
    if (!env.STRIPE_SECRET_KEY) return err('Stripe not configured');

    const sub = await env.DB.prepare(`SELECT stripe_customer_id FROM subscriptions WHERE tenant_id=?`).bind(ctx.tenantId).first() as any;
    if (!sub?.stripe_customer_id) return err('No billing account found — please subscribe first');

    const platformUrl = `https://${env.TENANT_DOMAIN ?? 'api-v2.xavvy.uk'}`;
    const portalRes = await stripeRequest(env, 'POST', '/v1/billing_portal/sessions', {
      customer:   sub.stripe_customer_id,
      return_url: `${platformUrl}/settings?tab=billing`,
    });
    const portal = await portalRes.json() as any;
    if (portal.error) return err(portal.error.message ?? 'Stripe error');

    return ok({ url: portal.url });
  }

  // POST /api/billing/webhook — Stripe webhook handler
  if (action === 'webhook' && request.method === 'POST') {
    const payload   = await request.text();
    const sigHeader = request.headers.get('stripe-signature') ?? '';

    // Verify webhook signature (skip in dev if secret not set)
    if (env.STRIPE_WEBHOOK_SECRET) {
      const valid = await verifyStripeWebhook(payload, sigHeader, env.STRIPE_WEBHOOK_SECRET);
      if (!valid) return new Response('Webhook signature verification failed', { status: 400 });
    }

    const event = JSON.parse(payload) as any;

    // Idempotency check
    const existing = await env.DB.prepare(`SELECT id FROM billing_events WHERE stripe_event_id=?`).bind(event.id).first();
    if (existing) return ok({ received: true, duplicate: true });

    // Log event
    await env.DB.prepare(`
      INSERT INTO billing_events (id,event_type,stripe_event_id,payload,processed)
      VALUES (?,?,?,?,0)
    `).bind(crypto.randomUUID(), event.type, event.id, JSON.stringify(event.data)).run();

    const obj = event.data.object;
    const tenantId = obj.metadata?.tenantId ?? '';

    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode === 'subscription' && tenantId) {
          await env.DB.prepare(`
            UPDATE subscriptions SET
              stripe_subscription_id=?, status='active', updated_at=CURRENT_TIMESTAMP
            WHERE tenant_id=?
          `).bind(obj.subscription, tenantId).run();
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        if (!tenantId) break;
        const planId = obj.items?.data?.[0]?.price?.id ?? '';
        const plan   = resolvePlanFromPriceId(planId, env);

        await env.DB.prepare(`
          UPDATE subscriptions SET
            plan=?, status=?, stripe_subscription_id=?,
            stripe_price_id=?, current_period_start=?, current_period_end=?,
            cancel_at_period_end=?, seat_count=?, updated_at=CURRENT_TIMESTAMP
          WHERE tenant_id=?
        `).bind(
          plan,
          obj.status,
          obj.id,
          planId,
          new Date(obj.current_period_start * 1000).toISOString(),
          new Date(obj.current_period_end   * 1000).toISOString(),
          obj.cancel_at_period_end ? 1 : 0,
          obj.items?.data?.[0]?.quantity ?? 5,
          tenantId
        ).run();

        // Update tenant plan
        await env.DB.prepare(`UPDATE tenants SET plan=? WHERE id=?`).bind(plan, tenantId).run();
        break;
      }

      case 'customer.subscription.deleted': {
        if (!tenantId) break;
        await env.DB.prepare(`
          UPDATE subscriptions SET plan='free', status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?
        `).bind(tenantId).run();
        await env.DB.prepare(`UPDATE tenants SET plan='free' WHERE id=?`).bind(tenantId).run();
        break;
      }

      case 'invoice.payment_failed': {
        const custId = obj.customer;
        if (custId) {
          await env.DB.prepare(`UPDATE subscriptions SET status='past_due' WHERE stripe_customer_id=?`).bind(custId).run();
        }
        break;
      }
    }

    // Mark processed
    await env.DB.prepare(`UPDATE billing_events SET processed=1 WHERE stripe_event_id=?`).bind(event.id).run();
    return ok({ received: true });
  }

  // GET /api/billing/plans — available plans with pricing
  if (action === 'plans' && request.method === 'GET') {
    return ok({
      plans: [
        {
          key:   'starter',
          name:  'Starter',
          price: { monthly: 4900, annual: 47040 }, // pence/pennies
          seats: 25,
          features: ['HR', 'Leave', 'Timesheets', 'Expenses', 'Compliance', 'Documents', 'Training', 'Announcements', 'Org Chart', 'Reporting'],
          highlight: false,
        },
        {
          key:   'professional',
          name:  'Professional',
          price: { monthly: 9900, annual: 95040 },
          seats: 100,
          features: ['Everything in Starter', 'Recruitment', 'Onboarding', 'Visa Management', 'Workflows', 'Scheduler', 'Checklists', 'Offboarding', 'Resource Planning', 'SOS Alerts', 'PMO'],
          highlight: true,
        },
        {
          key:   'enterprise',
          name:  'Enterprise',
          price: { monthly: -1, annual: -1 }, // custom
          seats: -1,
          features: ['Everything in Professional', 'Unlimited employees', 'Custom SSO', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'Custom branding'],
          highlight: false,
        },
      ],
    });
  }

  return err('Not found', 404);
}

// ── Stripe helpers ────────────────────────────────────────────────────────────
async function stripeRequest(
  env: Env, method: string, path: string, body?: Record<string, any>
): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Stripe-Version': '2023-10-16',
  };

  let bodyStr: string | undefined;
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    bodyStr = flattenToFormData(body);
  }

  return fetch(`https://api.stripe.com${path}`, { method, headers, body: bodyStr });
}

function flattenToFormData(obj: Record<string, any>, prefix = ''): string {
  const params = new URLSearchParams();
  function flatten(o: any, p: string) {
    if (Array.isArray(o)) {
      o.forEach((v, i) => flatten(v, `${p}[${i}]`));
    } else if (o !== null && typeof o === 'object') {
      Object.entries(o).forEach(([k, v]) => flatten(v, p ? `${p}[${k}]` : k));
    } else if (o !== undefined && o !== null) {
      params.append(p, String(o));
    }
  }
  flatten(obj, prefix);
  return params.toString();
}

function resolvePlanFromPriceId(priceId: string, env: Env): string {
  if (priceId.includes('enterprise')) return 'enterprise';
  if (priceId.includes('professional')) return 'professional';
  if (priceId.includes('starter')) return 'starter';
  // Check env variables
  for (const plan of ['enterprise', 'professional', 'starter']) {
    for (const interval of ['monthly', 'annual']) {
      const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}` as keyof Env;
      if ((env as any)[key] === priceId) return plan;
    }
  }
  return 'starter';
}

async function verifyStripeWebhook(
  payload: string, sigHeader: string, secret: string
): Promise<boolean> {
  try {
    const parts = sigHeader.split(',').reduce((acc: Record<string, string>, p) => {
      const [k, v] = p.split('=');
      acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts['t'];
    const sig       = parts['v1'];
    if (!timestamp || !sig) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const mac    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(mac), b => b.toString(16).padStart(2, '0')).join('');

    return expected === sig;
  } catch { return false; }
}
