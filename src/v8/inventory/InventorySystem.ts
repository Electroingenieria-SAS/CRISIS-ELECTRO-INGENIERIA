import type { InventoryItem } from '../types';

export class InventorySystem {
  private readonly items = new Map<string, InventoryItem>();

  add(item: InventoryItem, quantity = item.quantity ?? 1): InventoryItem {
    const existing = this.items.get(item.id);
    const next: InventoryItem = existing
      ? { ...existing, quantity: (existing.quantity ?? 1) + quantity }
      : { ...item, quantity };
    this.items.set(item.id, next);
    return next;
  }

  remove(id: string, quantity = 1): boolean {
    const existing = this.items.get(id);
    if (!existing) return false;
    const remaining = (existing.quantity ?? 1) - quantity;
    if (remaining <= 0) this.items.delete(id);
    else this.items.set(id, { ...existing, quantity: remaining });
    return true;
  }

  has(id: string, quantity = 1): boolean {
    return (this.items.get(id)?.quantity ?? 0) >= quantity;
  }

  get(id: string): InventoryItem | null {
    return this.items.get(id) ?? null;
  }

  list(): InventoryItem[] {
    return [...this.items.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  clear(): void {
    this.items.clear();
  }
}
