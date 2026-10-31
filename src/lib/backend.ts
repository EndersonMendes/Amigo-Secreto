import "server-only";
import { PartyService } from "./service";
import { createRepository } from "./repository";
import { env } from "./env";
export function backend() {
  return new PartyService(createRepository(), env().RATE_LIMIT_SECRET, env().CODE_LOOKUP_SECRET);
}
