export type Gifts = [string, string, string];

export interface PublicEvent {
  name: string;
  intro: string;
  home_text: string;
  event_date: string | null;
  registrations_open: boolean;
  draw_completed: boolean;
  participant_count: number;
}

export interface AdminEvent extends PublicEvent {
  draw_id: string | null;
  draw_at: string | null;
  revision: number;
}

export interface Participant {
  id: string;
  name: string;
  gifts: Gifts;
  created_at: string;
}

export interface Result {
  name: string;
  gifts: Gifts;
}

export interface Registration {
  name: string;
}

export interface DrawPair {
  giver: string;
  receiver: string;
}
