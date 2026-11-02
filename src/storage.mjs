export class StorageConflictError extends Error {
    constructor() {
        super("別のタブで記録が更新されています。");
        this.name = "StorageConflictError";
    }
}

export class ArchiveStorage {
    constructor(storage, key, initialRaw) {
        this.storage = storage;
        this.key = key;
        this.raw = initialRaw;
    }

    isCurrent() {
        return this.storage.getItem(this.key) === this.raw;
    }

    save(raw) {
        if (!this.isCurrent()) throw new StorageConflictError();
        if (raw === this.raw) return;
        this.storage.setItem(this.key, raw);
        this.raw = raw;
    }
}
