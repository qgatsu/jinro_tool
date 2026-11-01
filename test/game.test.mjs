import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createGameState, createPlayer, removePlayerReferences, canRecordDeath,
    reconcileDeathRecords, isDeadBeforeDay, setVote, deleteVote } from "../src/game.mjs";
import { createArchive, createMatch, parseArchive } from "../src/matches.mjs";

globalThis.crypto ??= webcrypto;

function fixture() {
    const state = createGameState([createPlayer("太郎"), createPlayer("花子"), createPlayer("次郎")]);
    state.days.push("2日目", "3日目");
    state.cursors.nextDayIndex = 4;
    return state;
}

test("renaming a player preserves all links and vote order through a fixed ID", () => {
    const s = fixture();
    const [a, b] = s.players;
    s.coSelections["role-2-1日目"] = a.id;
    s.roleAssignments["role-2"] = a.id;
    s.playerScales["1日目"] = { [a.id]: 0.8 };
    setVote(s, "1日目", a.id, b.id);
    const before = structuredClone(s.votingData);
    a.name = "改名後";
    assert.deepEqual(s.votingData, before);
    assert.equal(s.coSelections["role-2-1日目"], a.id);
    assert.equal(s.roleAssignments["role-2"], a.id);
    assert.equal(s.playerScales["1日目"][a.id], 0.8);
});

test("deleting a player cleans voter/target links in current votes, undo and redo", () => {
    const s = fixture();
    const [a, b, c] = s.players;
    s.votingData = { "1日目": { [a.id]: b.id, [b.id]: c.id, [c.id]: a.id } };
    s.votingHistory.push(structuredClone(s.votingData));
    s.votingFuture.push(structuredClone(s.votingData));
    s.coSelections["role-2-1日目"] = a.id;
    s.roleAssignments["role-2"] = a.id;
    s.playerScales["1日目"] = { [a.id]: 0.8 };
    s.cursors.pendingVoter = a.id;
    s.players.splice(0, 1);
    removePlayerReferences(s, a.id);
    for (const data of [s.votingData, ...s.votingHistory, ...s.votingFuture]) {
        assert.deepEqual(data["1日目"], { [b.id]: c.id });
    }
    assert.deepEqual(s.coSelections, {});
    assert.deepEqual(s.roleAssignments, {});
    assert.deepEqual(s.playerScales["1日目"], {});
    assert.equal(s.cursors.pendingVoter, null);
});

test("explicit deletion removes only the selected vote", () => {
    const s = fixture();
    const [a, b, c] = s.players;
    setVote(s, "1日目", a.id, b.id);
    setVote(s, "1日目", c.id, b.id);
    deleteVote(s, "1日目", a.id);
    assert.deepEqual(s.votingData["1日目"], { [c.id]: b.id });
});

test("numeric names and vote corrections preserve the original chronological order", () => {
    const s = fixture();
    const [a, b, c] = s.players;
    a.name = "10"; b.name = "2";
    setVote(s, "1日目", a.id, c.id);
    setVote(s, "1日目", b.id, c.id);
    assert.deepEqual(Object.keys(s.votingData["1日目"]), [a.id, b.id]);
    setVote(s, "1日目", a.id, b.id);
    assert.deepEqual(Object.keys(s.votingData["1日目"]), [a.id, b.id]);
    assert.equal(s.votingData["1日目"][a.id], b.id);
});

test("death eligibility follows each day, execution then attack, regardless of entry order", () => {
    const s = fixture();
    const [a] = s.players;
    s.coSelections["role-1-3日目"] = a.id;
    reconcileDeathRecords(s);
    assert.equal(canRecordDeath(s, "role-0", "1日目", a.id), true);
    s.coSelections["role-0-1日目"] = a.id;
    assert.deepEqual(reconcileDeathRecords(s), ["role-1-3日目"]);
    assert.deepEqual(s.deathRecords[a.id], { dayIndex: 0, phase: "吊り" });
    assert.equal(canRecordDeath(s, "role-1", "1日目", a.id), false);
    assert.equal(canRecordDeath(s, "role-0", "2日目", a.id), false);
    assert.equal(canRecordDeath(s, "role-0", "1日目", a.id), true);
});

test("correcting/removing an earlier death rebuilds the derived record", () => {
    const s = fixture();
    const [a, b] = s.players;
    s.coSelections["role-0-1日目"] = a.id;
    reconcileDeathRecords(s);
    s.coSelections["role-0-1日目"] = b.id;
    reconcileDeathRecords(s);
    assert.equal(s.deathRecords[a.id], undefined);
    assert.equal(canRecordDeath(s, "role-1", "2日目", a.id), true);
    delete s.coSelections["role-0-1日目"];
    reconcileDeathRecords(s);
    assert.deepEqual(s.deathRecords, {});
});

test("a person executed today may vote today, but cannot vote the next day", () => {
    const s = fixture();
    const [a, b] = s.players;
    s.coSelections["role-0-1日目"] = a.id;
    reconcileDeathRecords(s);
    assert.equal(isDeadBeforeDay(s, a.id, "1日目"), false);
    assert.equal(setVote(s, "1日目", a.id, b.id), true);
    assert.equal(setVote(s, "2日目", a.id, b.id), false);
    assert.equal(setVote(s, "2日目", b.id, a.id), false);
});

test("new matches carry only participants and never share mutable objects", () => {
    const first = createMatch(1, fixture().players);
    first.state.memoText = "前の試合";
    first.state.playerScales["1日目"][first.state.players[0].id] = 0.9;
    first.state.roleRows.push({ id: "role-5", label: "妖狐" });
    first.state.cursors.nextRoleId = 6;
    setVote(first.state, "1日目", first.state.players[0].id, first.state.players[1].id);
    const next = createMatch(2, first.state.players);
    assert.deepEqual(next.state.players, first.state.players);
    assert.equal(next.state.roleRows.length, 5);
    assert.deepEqual(next.state.votingData, {});
    assert.equal(next.state.memoText, "");
    assert.deepEqual(next.state.playerScales, {
        "1日目": Object.fromEntries(next.state.players.map((player) => [player.id, 0.5])),
    });
    next.state.players[0].name = "新しい名前";
    assert.equal(first.state.players[0].name, "太郎");
});

test("archive round trip retains multiple matches, scores, memo, undo and active match", () => {
    const archive = createArchive();
    archive.matches[0].state = fixture();
    archive.matches[0].state.memoText = "保存メモ";
    archive.matches[0].state.playerScales["1日目"] = { [archive.matches[0].state.players[0].id]: 0.75 };
    archive.matches[0].state.votingHistory.push({ "1日目": {} });
    const next = createMatch(2, archive.matches[0].state.players);
    archive.matches.push(next);
    archive.activeMatchId = next.id;
    assert.deepEqual(parseArchive(JSON.stringify(archive)), archive);
});

test("damaged, incompatible and incomplete archives are rejected", () => {
    assert.throws(() => parseArchive("{"));
    assert.throws(() => parseArchive('{"version":2}'));
    const archive = createArchive();
    delete archive.matches[0].state.votingData;
    assert.throws(() => parseArchive(JSON.stringify(archive)));
});


test("selecting the same pair is a no-op and never deletes the vote", () => {
    const s = fixture();
    const [a, b] = s.players;
    assert.equal(setVote(s, "1日目", a.id, b.id), true);
    assert.equal(setVote(s, "1日目", a.id, b.id), false);
    assert.deepEqual(s.votingData["1日目"], { [a.id]: b.id });
});

test("invalid corrections leave the original vote and chronological order intact", () => {
    const s = fixture();
    const [a, b, c] = s.players;
    setVote(s, "2日目", a.id, b.id);
    setVote(s, "2日目", b.id, a.id);
    s.coSelections["role-0-1日目"] = c.id;
    reconcileDeathRecords(s);
    const before = structuredClone(s.votingData);
    assert.equal(setVote(s, "2日目", a.id, c.id), false);
    assert.equal(setVote(s, "2日目", a.id, "missing"), false);
    assert.deepEqual(s.votingData, before);
});
