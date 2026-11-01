import { createGameState } from "./game.mjs?v=20261101-4";
const initial = createGameState();

export const players = [];
export const days = ["1日目"];
export const roleRows = initial.roleRows;
export const coSelections = {};
export const markerSelections = {};
export const roleAssignments = {};
export const deathRecords = {};
export const votingHistory = [];
export const playerScales = {};

export let votingData = {};
export let votingFuture = [];

export function setVotingData(value) {
    votingData = value;
}

export function setVotingFuture(value) {
    votingFuture = value;
}

export const cursors = initial.cursors;

export function currentState() {
    return { players, days, roleRows, coSelections, markerSelections, roleAssignments,
        deathRecords, votingHistory, votingData, votingFuture, playerScales, cursors };
}

export function restoreState(saved) {
    const next = structuredClone(saved);
    const current = currentState();
    for (const key of ["players", "days", "roleRows", "votingHistory"]) {
        current[key].splice(0, current[key].length, ...next[key]);
    }
    for (const key of ["coSelections", "markerSelections", "roleAssignments", "deathRecords", "playerScales", "cursors"]) {
        for (const prop of Object.keys(current[key])) delete current[key][prop];
        Object.assign(current[key], next[key]);
    }
    cursors.pendingVoter = null;
    cursors.editingPlayerIndex = null;
    setVotingData(next.votingData);
    setVotingFuture(next.votingFuture);
}

export const THEME_STORAGE_KEY = "jinro-tools-theme";
export const HELP_CONTENT_PATH = "help-content.html";
