export function createPlayer(name) {
    return { id: `player-${crypto.randomUUID()}`, name };
}

export function createGameState(participants = []) {
    return {
        players: participants.map((player) => ({ ...player })),
        days: ["1日目"],
        roleRows: ["吊り", "噛み", "占い師", "霊能者", "騎士"].map((label, i) => ({ id: `role-${i}`, label })),
        coSelections: {}, markerSelections: {}, roleAssignments: {}, deathRecords: {},
        votingData: {}, votingHistory: [], votingFuture: [],
        playerScales: { "1日目": Object.fromEntries(participants.map((player) => [player.id, 0.5])) },
        cursors: {
            nextDayIndex: 2, nextRoleId: 5, activeVotingDay: null,
            pendingVoter: null, editingPlayerIndex: null, activeCoTab: "voting", activeScaleDay: null,
        },
        memoText: "", resultText: "", rolesText: "",
    };
}

export function removePlayerReferences(state, playerId) {
    for (const selections of [state.coSelections, state.roleAssignments]) {
        for (const [key, value] of Object.entries(selections)) {
            if (value === playerId) {
                delete selections[key];
                if (selections === state.coSelections) delete state.markerSelections[key];
            }
        }
    }
    delete state.deathRecords[playerId];
    for (const scores of Object.values(state.playerScales)) delete scores[playerId];
    // Undo/redo must never resurrect a deleted participant's votes.
    for (const data of [state.votingData, ...state.votingHistory, ...state.votingFuture]) {
        for (const votes of Object.values(data)) {
            for (const [voter, target] of Object.entries(votes)) {
                if (voter === playerId || target === playerId) delete votes[voter];
            }
        }
    }
    if (state.cursors.pendingVoter === playerId) state.cursors.pendingVoter = null;
}

function deathEvents(state) {
    return state.days.flatMap((day, dayIndex) => ["吊り", "噛み"].flatMap((phase) =>
        state.roleRows.filter((role) => role.label === phase)
            .map((role) => ({ key: `${role.id}-${day}`, dayIndex, phase }))));
}

export function canRecordDeath(state, roleId, day, playerId) {
    if (!playerId) return true;
    if (!state.players.some((player) => player.id === playerId)) return false;
    const key = `${roleId}-${day}`;
    for (const event of deathEvents(state)) {
        if (event.key === key) return true;
        if (state.coSelections[event.key] === playerId) return false;
    }
    return false;
}

export function reconcileDeathRecords(state) {
    const validPlayers = new Set(state.players.map((player) => player.id));
    for (const key of Object.keys(state.deathRecords)) delete state.deathRecords[key];
    const removed = [];
    for (const event of deathEvents(state)) {
        const playerId = state.coSelections[event.key];
        if (!playerId) continue;
        if (!validPlayers.has(playerId) || state.deathRecords[playerId]) {
            delete state.coSelections[event.key];
            removed.push(event.key);
        } else {
            state.deathRecords[playerId] = { dayIndex: event.dayIndex, phase: event.phase };
        }
    }
    return removed;
}

// CO and voting happen before that day's execution/night attack.
export function isDeadBeforeDay(state, playerId, day) {
    const record = state.deathRecords[playerId];
    return Boolean(record && record.dayIndex < state.days.indexOf(day));
}

export function setVote(state, day, voter, target) {
    const ids = new Set(state.players.map((player) => player.id));
    if (!state.days.includes(day) || !ids.has(voter) || !ids.has(target)) return false;
    const votes = state.votingData[day] || {};
    if (votes[voter] === target) return false;
    if (isDeadBeforeDay(state, voter, day) || isDeadBeforeDay(state, target, day)) return false;
    state.votingData[day] = votes;
    // Updating an existing key preserves the original chronological position.
    votes[voter] = target;
    return true;
}

export function deleteVote(state, day, voter) {
    const votes = state.votingData[day];
    if (!votes || !Object.hasOwn(votes, voter)) return false;
    delete votes[voter];
    return true;
}
