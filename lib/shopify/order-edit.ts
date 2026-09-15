import { shopifyGraphQL } from "./client";

function toOrderGid(id: number | string)           { return `gid://shopify/Order/${id}`; }
function toCalcLineItemGid(id: number | string)    { return `gid://shopify/CalculatedLineItem/${id}`; }
function toVariantGid(id: number | string)         { return `gid://shopify/ProductVariant/${id}`; }

export interface EditItemInput {
  id: string;          // REST line item id string, OR "new-xxx" for new items
  name: string;
  qty: number;
  price: number;
  variantId?: number;  // only for items added via product picker
}

export interface OriginalItemInput {
  id: string;          // REST line item id string
  quantity: number;
}

interface UserError { field: string[]; message: string }

const SET_QTY = `
  mutation orderEditSetQuantity($id: ID!, $lineItemId: ID!, $quantity: Int!) {
    orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) {
      calculatedOrder { id }
      userErrors { field message }
    }
  }`;

const ADD_VARIANT = `
  mutation orderEditAddVariant($id: ID!, $variantId: ID!, $quantity: Int!) {
    orderEditAddVariant(id: $id, variantId: $variantId, quantity: $quantity, allowDuplicates: true) {
      calculatedLineItem { id quantity }
      userErrors { field message }
    }
  }`;

const ADD_CUSTOM = `
  mutation orderEditAddCustomItem($id: ID!, $title: String!, $quantity: Int!, $price: MoneyInput!) {
    orderEditAddCustomItem(id: $id, title: $title, quantity: $quantity, price: $price) {
      calculatedLineItem { id }
      userErrors { field message }
    }
  }`;

function checkErrors(errors: UserError[], label: string) {
  if (errors?.length) throw new Error(`${label}: ${errors.map((e) => e.message).join(", ")}`);
}

export async function editShopifyOrderItems(
  shopifyOrderId: number,
  originalItems: OriginalItemInput[],
  newItems: EditItemInput[],
  staffNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const orderGid = toOrderGid(shopifyOrderId);

    // Step 1 — Begin edit session
    const beginData = await shopifyGraphQL<{
      orderEditBegin: {
        calculatedOrder: { id: string } | null;
        userErrors: UserError[];
      };
    }>(
      `mutation orderEditBegin($id: ID!) {
        orderEditBegin(id: $id) {
          calculatedOrder { id }
          userErrors { field message }
        }
      }`,
      { id: orderGid },
    );

    checkErrors(beginData.orderEditBegin.userErrors, "orderEditBegin");
    const calcId = beginData.orderEditBegin.calculatedOrder?.id;
    if (!calcId) throw new Error("orderEditBegin returned no calculatedOrder");

    // Build lookup maps
    const origMap  = new Map(originalItems.map((i) => [i.id, i.quantity]));
    const newByKey = new Map(newItems.filter((i) => !i.id.startsWith("new-")).map((i) => [i.id, i]));

    // Step 2a — Remove items that no longer exist in the new list
    for (const orig of originalItems) {
      if (!newByKey.has(orig.id)) {
        const d = await shopifyGraphQL<{ orderEditSetQuantity: { userErrors: UserError[] } }>(
          SET_QTY,
          { id: calcId, lineItemId: toCalcLineItemGid(orig.id), quantity: 0 },
        );
        checkErrors(d.orderEditSetQuantity.userErrors, "setQuantity(remove)");
      }
    }

    // Step 2b — Update quantity of changed existing items
    for (const item of newItems) {
      if (item.id.startsWith("new-")) continue;
      const origQty = origMap.get(item.id);
      if (origQty !== undefined && origQty !== item.qty) {
        const d = await shopifyGraphQL<{ orderEditSetQuantity: { userErrors: UserError[] } }>(
          SET_QTY,
          { id: calcId, lineItemId: toCalcLineItemGid(item.id), quantity: item.qty },
        );
        checkErrors(d.orderEditSetQuantity.userErrors, "setQuantity(update)");
      }
    }

    // Step 2c — Add new items
    for (const item of newItems) {
      if (!item.id.startsWith("new-")) continue;

      if (item.variantId) {
        const d = await shopifyGraphQL<{ orderEditAddVariant: { userErrors: UserError[] } }>(
          ADD_VARIANT,
          { id: calcId, variantId: toVariantGid(item.variantId), quantity: item.qty },
        );
        checkErrors(d.orderEditAddVariant.userErrors, "addVariant");
      } else {
        const d = await shopifyGraphQL<{ orderEditAddCustomItem: { userErrors: UserError[] } }>(
          ADD_CUSTOM,
          {
            id: calcId,
            title: item.name,
            quantity: item.qty,
            price: { amount: String(item.price), currencyCode: "EGP" },
          },
        );
        checkErrors(d.orderEditAddCustomItem.userErrors, "addCustomItem");
      }
    }

    // Step 3 — Commit
    const commitData = await shopifyGraphQL<{
      orderEditCommit: {
        order: { id: string } | null;
        userErrors: UserError[];
      };
    }>(
      `mutation orderEditCommit($id: ID!, $notifyCustomer: Boolean!, $staffNote: String) {
        orderEditCommit(id: $id, notifyCustomer: $notifyCustomer, staffNote: $staffNote) {
          order { id }
          userErrors { field message }
        }
      }`,
      { id: calcId, notifyCustomer: false, staffNote: staffNote ?? "تعديل من XENO" },
    );

    checkErrors(commitData.orderEditCommit.userErrors, "orderEditCommit");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
