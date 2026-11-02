import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createPlayer, createGameState } from "../src/game.mjs";
import { buildMatchReport, safeExportName, pdfNames } from "../src/report.mjs";
import { createZip, crc32 } from "../src/zip.mjs";

globalThis.crypto ??= webcrypto;

function fixture() {
    const players = [createPlayer("太郎"), createPlayer("花子")];
    return { id: "match-1", title: "第1試合", state: createGameState(players) };
}

test("reports read the selected match's names, result, roles, memo and chronological votes", () => {
    const first = fixture();
    const [a, b] = first.state.players;
    first.state.resultText = "村人勝ち";
    first.state.rolesText = "狼：花子";
    first.state.memoText = "初戦のメモ";
    first.state.coSelections["role-2-1日目"] = b.id;
    first.state.markerSelections["role-2-1日目"] = "black";
    first.state.roleAssignments["role-2"] = a.id;
    first.state.votingData["1日目"] = { [a.id]: b.id, [b.id]: b.id };
    const second = { id: "match-2", title: "第2試合", state: createGameState(first.state.players) };
    second.state.players[0].name = "次郎";
    second.state.memoText = "第二試合";
    const before = structuredClone(first);
    const report = buildMatchReport(first, { gmName: " GM太郎 ", sessionName: "人狼会", exportedAt: "2026-11-03" });
    assert.equal(report.coTable.rows[2][0], "占い師\n太郎");
    assert.equal(report.coTable.rows[2][1], "花子 ●");
    assert.deepEqual(report.votes[0].rows, [["太郎", "花子", "1票目 / 2票"], ["花子", "花子", "2票目 / 2票"]]);
    assert.equal(report.gmName, "GM太郎");
    assert.equal(report.memoText, "初戦のメモ");
    assert.equal(report.resultText, "村人勝ち");
    assert.equal(report.rolesText, "狼：花子");
    assert.equal(buildMatchReport(second).memoText, "第二試合");
    assert.deepEqual(first, before);
});

test("scale report includes first day, preserves 0 and 1, and skips unpopulated later days", () => {
    const match = fixture();
    const s = match.state;
    const [a, b] = s.players;
    s.days.push("2日目", "3日目");
    s.playerScales["1日目"] = { [a.id]: 0, [b.id]: 1 };
    s.playerScales["2日目"] = { [a.id]: 0.8 };
    s.deathRecords[a.id] = { dayIndex: 0, phase: "吊り" };
    const { scales } = buildMatchReport(match);
    assert.deepEqual(scales.map((entry) => entry.day), ["1日目", "2日目"]);
    assert.deepEqual(scales[0].rows.map((row) => row.value), [0, 1]);
    assert.equal(scales[0].rows[0].dead, true);
    assert.equal(scales[0].rows[1].dead, false);
    assert.equal(scales[1].rows[1].value, 0.5);
    delete s.playerScales["1日目"];
    assert.deepEqual(buildMatchReport(match).scales[0].rows.map((row) => row.value), [0.5, 0.5]);
});

test("Japanese export filenames stay inside one safe folder and avoid duplicate filenames", () => {
    assert.equal(safeExportName("../人狼会/夜"), "_人狼会_夜");
    assert.equal(safeExportName("..."), "人狼記録");
    assert.equal(safeExportName("CON"), "_CON");
    assert(new TextEncoder().encode(safeExportName("人".repeat(100))).length <= 100);
    assert.deepEqual(pdfNames([{ title: "第1試合" }, { title: "第1試合" }]), ["第1試合.pdf", "第1試合 (2).pdf"]);
    assert.deepEqual(pdfNames([{ title: "A" }, { title: "a" }]), ["A.pdf", "a (2).pdf"]);
});

test("PDF filenames use each match's date, the common village name, and the match number", () => {
    const matches = [
        { title: "第1試合", createdAt: new Date(2026, 10, 2, 12).toISOString() },
        { title: "第2試合", createdAt: new Date(2026, 10, 3, 12).toISOString() },
    ];
    assert.deepEqual(pdfNames(matches, { villageName: "月夜の村" }), [
        "2026-11-02_月夜の村_第1試合.pdf", "2026-11-03_月夜の村_第2試合.pdf",
    ]);
    const match = fixture();
    match.createdAt = matches[0].createdAt;
    assert.equal(buildMatchReport(match).matchDate, "2026-11-02");
});

test("ZIP output interoperates with Python zipfile including Japanese paths and CRC checks", async () => {
    const encoder = new TextEncoder();
    assert.equal(crc32(encoder.encode("123456789")), 0xcbf43926);
    const zip = createZip([
        { name: "人狼会/第1試合.pdf", data: encoder.encode("%PDF-1.4 first") },
        { name: "人狼会/第2試合.pdf", data: encoder.encode("%PDF-1.4 second") },
    ]);
    const output = execFileSync("python3", ["-c", `
import io, sys, zipfile, json
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
    assert z.testzip() is None
    assert z.read('人狼会/第1試合.pdf') == b'%PDF-1.4 first'
    assert z.read('人狼会/第2試合.pdf') == b'%PDF-1.4 second'
    print(json.dumps(z.namelist(), ensure_ascii=False))
`], { input: Buffer.from(await zip.arrayBuffer()), encoding: "utf8", timeout: 5000 });
    assert.deepEqual(JSON.parse(output), ["人狼会/第1試合.pdf", "人狼会/第2試合.pdf"]);
});

test("ZIP rejects path traversal, duplicate entries and empty archives", () => {
    const data = new Uint8Array([1]);
    assert.throws(() => createZip([{ name: "../bad.pdf", data }]));
    assert.throws(() => createZip([{ name: "/bad.pdf", data }]));
    assert.throws(() => createZip([{ name: "bad.pdf", data }, { name: "bad.pdf", data }]));
    assert.throws(() => createZip([]));
});
