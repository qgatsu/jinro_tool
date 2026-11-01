import { createGameState } from "./game.mjs?v=20261101-4";

export const MATCHES_STORAGE_KEY = "jinro-tools-matches-v1";

export function createMatch(number, participants = []) {
    const now = new Date().toISOString();
    return { id: crypto.randomUUID(), title: `第${number}試合`, createdAt: now, updatedAt: now,
        state: createGameState(participants) };
}

export function createArchive() {
    const match = createMatch(1);
    return { version: 1, activeMatchId: match.id, matches: [match] };
}

export function parseArchive(raw) {
    if (raw === null) return createArchive();
    const archive = JSON.parse(raw);
    const object = (value) => value && typeof value === "object" && !Array.isArray(value);
    const invalid = () => { throw new Error("保存データの形式が不正です。"); };
    if (!object(archive) || archive.version !== 1 || !Array.isArray(archive.matches) || !archive.matches.length) invalid();
    const matchIds = new Set();
    for (const match of archive.matches) {
        if (!object(match) || typeof match.id !== "string" || matchIds.has(match.id) || typeof match.title !== "string") invalid();
        matchIds.add(match.id);
        const s = match.state;
        if (!object(s)) invalid();
        for (const key of ["players", "days", "roleRows", "votingHistory", "votingFuture"]) {
            if (!Array.isArray(s[key])) invalid();
        }
        if (!s.days.length || s.days.some((day, i) => day !== `${i + 1}日目`)) invalid();
        const ids = new Set();
        for (const p of s.players) {
            if (!object(p) || typeof p.id !== "string" || !p.id.startsWith("player-") || ids.has(p.id) || typeof p.name !== "string") invalid();
            ids.add(p.id);
        }
        if (!s.roleRows.length || s.roleRows.some((r) => !object(r) || typeof r.id !== "string" || !/^role-\d+$/.test(r.id) || typeof r.label !== "string")) invalid();
        for (const key of ["coSelections", "markerSelections", "roleAssignments", "deathRecords", "playerScales", "votingData", "cursors"]) {
            if (!object(s[key])) invalid();
        }
        for (const data of [s.votingData, ...s.votingHistory, ...s.votingFuture, s.playerScales]) {
            if (!object(data) || Object.values(data).some((row) => !object(row))) invalid();
        }
        for (const key of ["memoText", "resultText", "rolesText"]) if (typeof s[key] !== "string") invalid();
        if (!Number.isInteger(s.cursors.nextDayIndex) || !Number.isInteger(s.cursors.nextRoleId)) invalid();
    }
    if (!matchIds.has(archive.activeMatchId)) invalid();
    return archive;
}
