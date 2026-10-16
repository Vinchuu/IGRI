export type MatchStatus = 'DRAFT' | 'OPEN' | 'LOCKED' | 'SETTLED' | 'CANCELLED';
export type TicketStatus = 'SUBMITTED' | 'ACTIVE' | 'WON' | 'LOST' | 'REFUNDED';
export type LegStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';
export type MarketType = 'WINNER' | 'TOP_3' | 'TOP_FRAGGER';
export type SeasonStatus = 'DRAFT' | 'ACTIVE' | 'SETTLED' | 'CANCELLED';

export type TransactionType =
  | 'STARTING_GRANT'
  | 'DAILY_REWARD'
  | 'TICKET_STAKE'
  | 'TICKET_REFUND'
  | 'TICKET_PAYOUT'
  | 'SHOP_PURCHASE'
  | 'ADMIN_ADJUSTMENT';

export interface UserAccount {
  id: string; // Discord user ID
  username: string;
  balance: number;
  reserved_stake: number;
  last_daily_claim: number | null; // Unix timestamp ms
  daily_streak: number;
  lifetime_profit: number;
  lifetime_won_payouts: number;
  lifetime_stakes: number;
  resolved_selections: number;
  correct_selections: number;
  biggest_win_payout: number;
  equipped_title: string;
  created_at: number;
}

export interface Season {
  id: number;
  name: string;
  status: SeasonStatus;
  total_pool: number;
  distributable_pool: number;
  rollover_amount: number;
  created_at: number;
  settled_at: number | null;
}

export interface Match {
  id: number;
  season_id: number;
  match_number: number;
  lobby_name: string;
  scheduled_time: number; // Unix timestamp ms
  deadline: number; // Prediction cutoff timestamp ms
  status: MatchStatus;
  participating_teams: string[]; // JSON array of team names
  participating_players?: string[]; // JSON array of star players/fraggers
  result_winner?: string; // 1st Place Team
  result_second?: string; // 2nd Place Team
  result_third?: string; // 3rd Place Team
  result_top_fragger?: string; // Top fragger team or player
  created_at: number;
}

export interface Ticket {
  id: number;
  user_id: string;
  season_id: number;
  stake: number;
  status: TicketStatus;
  combo_weight: number;
  payout: number;
  is_insured: number; // 0 or 1
  created_at: number;
  legs?: TicketLeg[];
}

export interface TicketLeg {
  id: number;
  ticket_id: number;
  match_id: number;
  market_type: MarketType;
  selected_target: string;
  locked_odds: number;
  status: LegStatus;
}

export interface TransactionLedgerEntry {
  id: number;
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  notes: string | null;
  created_at: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'ROLE' | 'TITLE' | 'BADGE';
  role_id?: string;
  badge_emoji?: string;
}

export interface UserInventoryItem {
  id: number;
  user_id: string;
  item_id: string;
  acquired_at: number;
}
