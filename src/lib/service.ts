import "server-only";
import { createHmac } from "node:crypto";
import type { Rpc } from "./repository";
import { AppError, databaseError, invalidCredentials } from "./errors";
import { DUMMY_HASH, codeFingerprint, hashNumericCode, verifyCode, generateRecoveryToken, recoveryHash } from "./codes";
import { generateDerangement } from "./draw";
import {
  participantInput, clearInput, recoverInput,
  revealInput,
  eventInput,
  editInput,
  idInput,
  drawInput,
  resetInput,
  normalizeText,
} from "./validation";
import type { PublicEvent, AdminEvent, Participant, Result } from "./types";
export class PartyService {
  constructor(
    private readonly db: Rpc,
    private readonly rateSecret: string,
    private readonly codeSecret: string,
  ) {}
  publicEvent() {
    return this.db.call<PublicEvent>("as_public_event");
  }
  adminEvent() {
    return this.db.call<AdminEvent>("as_admin_event");
  }
  participants() {
    return this.db.call<Participant[]>("as_participants");
  }
  publicParticipants() {
    return this.db.call<string[]>("as_public_participants");
  }
  async limit(scope: string, identity: string, limit: number, seconds: number) {
    const key = createHmac("sha256", this.rateSecret)
      .update(`${scope}:${normalizeText(identity).toLowerCase()}`)
      .digest("hex");
    const allowed = await this.db.call<boolean>("as_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: seconds,
    });
    if (!allowed)
      throw new AppError(
        "RATE_LIMITED",
        429,
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        seconds,
      );
  }
  async register(input: unknown) {
    const { name, gifts, code } = participantInput.parse(input);
    await this.db.call<string>("as_register", {
      p_name: name, p_gifts: gifts,
      p_code_hash: await hashNumericCode(code, this.codeSecret),
      p_fingerprint: codeFingerprint(code, this.codeSecret),
      p_code_length: code.length,
    });
    return { name };
  }
  async reveal(input: unknown): Promise<Result> {
    const parsed = revealInput.safeParse(input);
    if (!parsed.success) throw invalidCredentials();
    const { name, code } = parsed.data;
    const found = await this.db.call<{ name_key: string; candidates: { id: string; code_hash: string }[] }>(
      "as_find_participant", { p_name: name, p_fingerprint: codeFingerprint(code, this.codeSecret) },
    );
    // DB canonical identity is shared by homonyms and Unicode aliases, even on wrong codes.
    await this.limit("reveal-name", found.name_key, 10, 900);
    const matches = [];
    for (const candidate of found.candidates) {
      if (await verifyCode(code, candidate.code_hash, this.codeSecret)) matches.push(candidate);
    }
    if (!found.candidates.length) await verifyCode(code, DUMMY_HASH);
    if (matches.length !== 1) throw invalidCredentials();
    const participant = matches[0];
    const result = await this.db.call<Result | null>("as_reveal", {
      p_id: participant.id, p_code_hash: participant.code_hash,
    });
    if (!result) throw invalidCredentials();
    return { name: result.name, gifts: result.gifts };
  }
  async editParticipant(input: unknown) {
    const value = editInput.parse(input);
    if (value.action === "delete")
      await this.db.call("as_delete_participant", { p_id: value.id });
    else
      await this.db.call("as_edit_participant", {
        p_id: value.id,
        p_name: value.name,
        p_gifts: value.gifts,
      });
    return { ok: true };
  }
  async resetCode(input: unknown) {
    const { id } = idInput.parse(input);
    const token = generateRecoveryToken();
    const name = await this.db.call<string>("as_issue_recovery", {
      p_id: id, p_token_hash: recoveryHash(token),
    });
    return { name, token };
  }
  async redeemCode(input: unknown) {
    const { token, code } = recoverInput.parse(input);
    await this.limit("recover-token", recoveryHash(token), 10, 900);
    const name = await this.db.call<string>("as_redeem_recovery", {
      p_token_hash: recoveryHash(token),
      p_code_hash: await hashNumericCode(code, this.codeSecret),
      p_fingerprint: codeFingerprint(code, this.codeSecret),
      p_code_length: code.length,
    });
    return { name };
  }
  clearDatabase(input: unknown) {
    const { revision } = clearInput.parse(input);
    return this.db.call<AdminEvent>("as_clear_database", { p_revision: revision });
  }
  async updateEvent(input: unknown) {
    const v = eventInput.parse(input);
    return this.db.call<AdminEvent>("as_update_event", {
      p_name: v.name,
      p_intro: v.intro,
      p_home_text: v.home_text,
      p_event_date: v.event_date,
      p_open: v.registrations_open,
      p_revision: v.revision,
    });
  }
  async draw(input: unknown) {
    const { revision } = drawInput.parse(input);
    const event = await this.adminEvent();
    if (event.draw_completed) throw databaseError("DRAW_EXISTS");
    if (event.registrations_open) throw databaseError("REGISTRATION_OPEN");
    if (event.revision !== revision) throw databaseError("STALE_EVENT");
    const participants = await this.participants();
    if (participants.length < 2) throw databaseError("TOO_FEW_PARTICIPANTS");
    const pairs = generateDerangement(participants.map((p) => p.id));
    return this.db.call<AdminEvent>("as_commit_draw", {
      p_pairs: pairs,
      p_revision: revision,
    });
  }
  drawResults() {
    return this.db.call<{ giver: string; receiver: string }[]>(
      "as_draw_results",
    );
  }
  resetDraw(input: unknown) {
    const v = resetInput.parse(input);
    return this.db.call<AdminEvent>("as_reset_draw", { p_draw_id: v.draw_id });
  }
}
