import test from "node:test";
import assert from "node:assert/strict";
import { ArchiveStorage, StorageConflictError } from "../src/storage.mjs";

function storage(initial = "initial") {
    let raw = initial;
    let writes = 0;
    return {
        getItem: () => raw,
        setItem: (_, value) => { raw = value; writes += 1; },
        get writes() { return writes; },
    };
}

test("an older tab cannot overwrite another tab's new record", () => {
    const saved = storage();
    const first = new ArchiveStorage(saved, "matches", "initial");
    const second = new ArchiveStorage(saved, "matches", "initial");
    second.save("new record");
    assert.equal(first.isCurrent(), false);
    assert.throws(() => first.save("old tab's data"), StorageConflictError);
    assert.equal(saved.getItem(), "new record");
});

test("opening a second tab or saving unchanged content does not invalidate the first tab", () => {
    const saved = storage();
    const first = new ArchiveStorage(saved, "matches", "initial");
    const second = new ArchiveStorage(saved, "matches", "initial");
    second.save("initial");
    assert.equal(saved.writes, 0);
    assert.equal(first.isCurrent(), true);
    first.save("edited");
    first.save("edited again");
    assert.equal(saved.getItem(), "edited again");
});

test("reset records cannot be resurrected by an older tab", () => {
    const saved = storage("old history");
    const old = new ArchiveStorage(saved, "matches", "old history");
    const current = new ArchiveStorage(saved, "matches", "old history");
    current.save("empty first match");
    assert.throws(() => old.save("old history"), StorageConflictError);
    assert.equal(saved.getItem(), "empty first match");
});

test("a failed storage write can be retried without pretending it succeeded", () => {
    const saved = storage();
    const original = saved.setItem;
    saved.setItem = () => { throw new Error("quota"); };
    const writer = new ArchiveStorage(saved, "matches", "initial");
    assert.throws(() => writer.save("new"), /quota/);
    saved.setItem = original;
    writer.save("new");
    assert.equal(saved.getItem(), "new");
});
