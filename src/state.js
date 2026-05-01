const baseRoles = ["吊り", "噛み", "占い師", "霊能者", "騎士"];

export const players = [];
export const days = ["1日目"];
export const roleRows = baseRoles.map((label, index) => ({ id: `role-${index}`, label }));
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

export const cursors = {
    nextDayIndex: 2,
    nextRoleId: baseRoles.length,
    activeVotingDay: null,
    pendingVoter: null,
    editingPlayerIndex: null,
    activeCoTab: "voting",
    activeScaleDay: null,
};

export const THEME_STORAGE_KEY = "jinro-tools-theme";
export const HELP_CONTENT_PATH = "help-content.html";
