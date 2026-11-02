export function formatExportDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function safeExportName(value, fallback = "人狼記録") {
    const cleaned = String(value || "").normalize("NFC").trim()
        .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_").replace(/^\.+/, "").replace(/[. ]+$/, "");
    let name = "";
    for (const char of cleaned) {
        if (new TextEncoder().encode(name + char).length > 100) break;
        name += char;
    }
    name = name.replace(/[. ]+$/, "") || fallback;
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) name = `_${name}`;
    return name;
}

export function matchDate(match, fallback = formatExportDate()) {
    const date = new Date(match.createdAt);
    return Number.isNaN(date.getTime()) ? fallback : formatExportDate(date);
}

export function pdfNames(matches, { villageName = "", exportedAt = formatExportDate() } = {}) {
    const used = new Set();
    return matches.map((match, index) => {
        const title = safeExportName(match.title, `第${index + 1}試合`);
        const base = villageName ? `${matchDate(match, exportedAt)}_${safeExportName(villageName)}_${title}` : title;
        let name = `${base}.pdf`;
        for (let suffix = 2; used.has(name.toLowerCase()); suffix += 1) name = `${base} (${suffix}).pdf`;
        used.add(name.toLowerCase());
        return name;
    });
}

export function buildMatchReport(match, { sessionName = "", gmName = "", exportedAt = formatExportDate() } = {}) {
    const s = match.state;
    const names = new Map(s.players.map((player) => [player.id, player.name]));
    const nameOf = (id) => names.get(id) || "不明なプレイヤー";
    const coRows = s.roleRows.map((role) => {
        const assignment = s.roleAssignments[role.id] ? nameOf(s.roleAssignments[role.id]) : "";
        const label = assignment ? `${role.label}\n${assignment}` : role.label;
        return [label, ...s.days.map((day) => {
            const key = `${role.id}-${day}`;
            const id = s.coSelections[key];
            if (!id) return "-";
            const marker = role.label === "吊り" || role.label === "噛み" ? "" : s.markerSelections[key] === "black" ? " ●" : " ○";
            return nameOf(id) + marker;
        })];
    });
    const votes = s.days.map((day) => {
        const entries = Object.entries(s.votingData[day] || {});
        const counts = new Map();
        entries.forEach(([, target]) => counts.set(target, (counts.get(target) || 0) + 1));
        const orders = new Map();
        return { day, rows: entries.map(([voter, target]) => {
            const order = (orders.get(target) || 0) + 1;
            orders.set(target, order);
            return [nameOf(voter), nameOf(target), `${order}票目 / ${counts.get(target)}票`];
        }) };
    });
    const scales = s.days.flatMap((day, index) => {
        if (index !== 0 && !s.playerScales[day]) return [];
        return [{ day, rows: s.players.map((player) => {
            const stored = s.playerScales[day]?.[player.id];
            const value = typeof stored === "number" && Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 0.5;
            const death = s.deathRecords[player.id];
            return { name: player.name, value, dead: Boolean(death && death.dayIndex <= index) };
        }) }];
    });
    return {
        matchTitle: match.title, sessionName: sessionName.trim(), gmName: gmName.trim(), exportedAt,
        matchDate: matchDate(match, exportedAt),
        coTable: { headers: ["役職", ...s.days], rows: coRows }, votes, scales,
        memoText: s.memoText.trim() || "メモは記録されていません。",
        resultText: s.resultText.trim() || "未入力", rolesText: s.rolesText.trim() || "未入力",
    };
}
