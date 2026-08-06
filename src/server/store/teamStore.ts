import path from "node:path";
import { DEFAULT_POLICY_DIR } from "../../policy/loader";
import { JsonArrayStore } from "./jsonStore";

/** T-21: local metadata for a Team — OpenFGA (see authz/model.fga) holds *who has what relation*
 * to a team; this store holds the *display* metadata (name, who/when created) that has no natural
 * home in a pure relationship graph. */
export interface Team {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

const TEAMS_PATH = path.join(DEFAULT_POLICY_DIR, "..", "teams.json");
const store = new JsonArrayStore<Team>(TEAMS_PATH);

export function listTeams(): Team[] {
  return store.readAll();
}

export function getTeam(id: string): Team | null {
  return store.readAll().find((t) => t.id === id) ?? null;
}

export function createTeam(input: { id: string; name: string; createdBy: string }): Team {
  if (getTeam(input.id)) {
    throw new Error(`Team "${input.id}" already exists.`);
  }
  const team: Team = { ...input, createdAt: new Date().toISOString() };
  store.append(team);
  return team;
}
