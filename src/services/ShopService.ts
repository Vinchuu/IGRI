import { db } from '../database/db.js';
import { ShopItem } from '../types/index.js';
import { LedgerService } from './LedgerService.js';
import { UserService } from './UserService.js';

export class ShopService {
  /**
   * Fetches all available shop items
   */
  static getItems(): ShopItem[] {
    return db.prepare('SELECT * FROM shop_items ORDER BY cost ASC').all() as ShopItem[];
  }

  /**
   * Purchases an item for a user
   */
  static buyItem(userId: string, username: string, itemId: string): { success: boolean; item: ShopItem; newBalance: number } {
    const user = UserService.getOrCreateUser(userId, username);
    const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId) as ShopItem | undefined;
    if (!item) {
      throw new Error(`Shop item "${itemId}" not found.`);
    }

    // Check if user already owns it
    const owned = db.prepare('SELECT id FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (owned) {
      throw new Error(`You already own "${item.name}"!`);
    }

    // Check balance
    if (user.balance < item.cost) {
      throw new Error(`Insufficient coins! "${item.name}" costs ${item.cost.toLocaleString()} coins, but you only have ${user.balance.toLocaleString()} coins.`);
    }

    let updatedBalance = 0;
    const now = Date.now();

    const executePurchase = db.transaction(() => {
      updatedBalance = LedgerService.record(
        userId,
        'SHOP_PURCHASE',
        -item.cost,
        itemId,
        `Purchased ${item.name} from Arena Shop`
      );

      db.prepare(`
        INSERT INTO user_inventory (user_id, item_id, acquired_at)
        VALUES (?, ?, ?)
      `).run(userId, itemId, now);

      // If it's a title, automatically equip it
      if (item.type === 'TITLE') {
        db.prepare('UPDATE users SET equipped_title = ? WHERE id = ?').run(item.name, userId);
      }
    });

    executePurchase();

    return {
      success: true,
      item,
      newBalance: updatedBalance,
    };
  }
}
