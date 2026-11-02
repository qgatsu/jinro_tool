// ZIP "stored" entries with UTF-8 names. PDFs already contain JPEG-compressed pages.
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i += 1) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
});

export function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

export function createZip(entries, date = new Date()) {
    if (!entries.length || entries.length > 65535) throw new Error("出力する試合数を減らしてください。");
    const encoder = new TextEncoder();
    const localParts = [];
    const directoryParts = [];
    const seen = new Set();
    let offset = 0;
    let directorySize = 0;
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    const day = ((Math.min(2107, Math.max(1980, date.getFullYear())) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    for (const { name, data } of entries) {
        if (!(data instanceof Uint8Array) || !name || name.includes("\\") || name.startsWith("/") || name.includes("\0") || name.split("/").some((part) => !part || part === "." || part === "..") || seen.has(name)) {
            throw new Error("ZIPのファイル名またはデータが不正です。");
        }
        seen.add(name);
        const filename = encoder.encode(name);
        if (filename.length > 65535 || data.length > 0xffffffff || offset + 30 + filename.length + data.length > 0xffffffff) throw new Error("ZIPのサイズが大きすぎます。試合数を減らしてください。");
        const crc = crc32(data);
        const header = new Uint8Array(30);
        const h = new DataView(header.buffer);
        h.setUint32(0, 0x04034b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 0x0800, true);
        h.setUint16(10, time, true); h.setUint16(12, day, true);
        h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
        h.setUint16(26, filename.length, true);
        const central = new Uint8Array(46);
        const c = new DataView(central.buffer);
        c.setUint32(0, 0x02014b50, true);
        c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
        c.setUint16(12, time, true); c.setUint16(14, day, true);
        c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
        c.setUint16(28, filename.length, true); c.setUint32(42, offset, true);
        localParts.push(header, filename, data);
        directoryParts.push(central, filename);
        offset += header.length + filename.length + data.length;
        directorySize += central.length + filename.length;
    }
    if (offset + directorySize + 22 > 0xffffffff) throw new Error("ZIPのサイズが大きすぎます。試合数を減らしてください。");
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
    e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
    return new Blob([...localParts, ...directoryParts, end], { type: "application/zip" });
}
