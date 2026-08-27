import { shopifyFetch, shopifyPost } from "./client";

interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

interface ShopifyLocation {
  id: number;
  name: string;
  active: boolean;
}

export async function getLocations(): Promise<ShopifyLocation[]> {
  const data = await shopifyFetch<{ locations: ShopifyLocation[] }>(
    "/locations.json"
  );
  return data.locations.filter((l) => l.active);
}

export async function getInventoryLevels(
  locationId: number,
  limit = 250
): Promise<ShopifyInventoryLevel[]> {
  const data = await shopifyFetch<{ inventory_levels: ShopifyInventoryLevel[] }>(
    `/inventory_levels.json?location_ids=${locationId}&limit=${limit}`
  );
  return data.inventory_levels;
}

export async function adjustInventory(
  inventoryItemId: number,
  locationId: number,
  adjustment: number
): Promise<void> {
  await shopifyPost("/inventory_levels/adjust.json", {
    location_id:        locationId,
    inventory_item_id:  inventoryItemId,
    available_adjustment: adjustment,
  });
}

export async function setInventory(
  inventoryItemId: number,
  locationId: number,
  quantity: number
): Promise<void> {
  await shopifyPost("/inventory_levels/set.json", {
    location_id:       locationId,
    inventory_item_id: inventoryItemId,
    available:         quantity,
  });
}
