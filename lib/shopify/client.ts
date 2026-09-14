const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

const BASE     = `https://${SHOP}/admin/api/${VERSION}`;
const GQL_URL  = `https://${SHOP}/admin/api/${VERSION}/graphql.json`;

export async function shopifyFetch<T>(endpoint: string, options?: { revalidate?: number }): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    next: { revalidate: options?.revalidate ?? 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function shopifyPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function shopifyPut<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function shopifyGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL ${res.status}: ${text}`);
  }

  const json = await res.json() as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

export async function shopifyFetchRaw(endpoint: string): Promise<Response> {
  return fetch(`${BASE}${endpoint}`, {
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}
