import {
    players,
    days,
    roleRows,
    coSelections,
    markerSelections,
    roleAssignments,
    deathRecords,
    votingHistory,
    votingData,
    votingFuture,
    setVotingData,
    setVotingFuture,
    cursors,
    playerScales,
    THEME_STORAGE_KEY,
    HELP_CONTENT_PATH,
    currentState,
    restoreState,
} from "./src/state.js?v=20261101-4";
import { createPlayer, removePlayerReferences, canRecordDeath, reconcileDeathRecords, isDeadBeforeDay, setVote, deleteVote } from "./src/game.mjs?v=20261101-4";
import { MATCHES_STORAGE_KEY, createArchive, createMatch, parseArchive } from "./src/matches.mjs?v=20261101-4";

const playerListEl = document.getElementById("playersList");
const playerForm = document.getElementById("playerForm");
const countEl = document.querySelector(".count");
const coTableEl = document.getElementById("coTable");
const addRoleBtn = document.getElementById("addRoleBtn");
const votingTabsEl = document.getElementById("votingTabs");
const votingContentEl = document.getElementById("votingContent");
const openBulkModalBtn = document.getElementById("openBulkModalBtn");
const bulkModalEl = document.getElementById("bulkModal");
const bulkModalClose = document.getElementById("bulkModalClose");
const bulkCancelBtn = document.getElementById("bulkCancelBtn");
const bulkSubmitBtn = document.getElementById("bulkSubmitBtn");
const bulkInputEl = document.getElementById("bulkPlayersInput");
const undoVoteBtn = document.getElementById("undoVoteBtn");
const redoVoteBtn = document.getElementById("redoVoteBtn");
const deleteVoteBtn = document.getElementById("deleteVoteBtn");
let voteDrag = null;
let voteResizeObserver;
let voteEndpointController;
const themeToggleBtn = document.getElementById("themeToggle");
const memoTextarea = document.querySelector(".memo-textarea");
const exportModalEl = document.getElementById("exportModal");
const exportModalClose = document.getElementById("exportModalClose");
const exportCancelBtn = document.getElementById("exportCancelBtn");
const exportSubmitBtn = document.getElementById("exportSubmitBtn");
const exportResultInput = document.getElementById("exportResultInput");
const exportRolesInput = document.getElementById("exportRolesInput");
const openExportModalBtn = document.getElementById("openExportModalBtn");
const openHelpModalBtn = document.getElementById("openHelpModalBtn");
const helpModalEl = document.getElementById("helpModal");
const matchSelect = document.getElementById("matchSelect");
const newMatchBtn = document.getElementById("newMatchBtn");
const saveStatus = document.getElementById("saveStatus");
let matchArchive;
let archiveWritable = true;
let saveTimer;

function playerName(id) {
    return players.find((player) => player.id === id)?.name || "不明なプレイヤー";
}

function getKey(roleId, day) {
    return `${roleId}-${day}`;
}

function renderPlayers() {
    playerListEl.innerHTML = "";

    if (players.length === 0) {
        const empty = document.createElement("li");
        empty.className = "player-card empty";
        empty.textContent = "未登録です。下のフォームから追加してください。";
        playerListEl.appendChild(empty);
        countEl.textContent = "0 人";
    } else {
        players.forEach((player, index) => {
            const item = document.createElement("li");
            item.className = "player-card";
            if (cursors.editingPlayerIndex === index) {
                item.classList.add("editing");
                const input = document.createElement("input");
                input.type = "text";
                input.value = player.name;
                input.className = "player-edit-input";
                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        finishEditingPlayer(index, input.value.trim(), player.name);
                    } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEditingPlayer();
                    }
                });
                input.addEventListener("blur", () => {
                    if (cursors.editingPlayerIndex === index) {
                        cancelEditingPlayer();
                    }
                });
                queueMicrotask(() => {
                    input.focus();
                    input.select();
                });
                item.appendChild(input);

                const actions = document.createElement("div");
                actions.className = "player-card-actions";

                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.className = "delete-btn";
                deleteBtn.setAttribute("aria-label", `${player.name} を削除`);
                deleteBtn.textContent = "×";
                deleteBtn.addEventListener("pointerdown", (event) => event.preventDefault());
                deleteBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    deletePlayer(index);
                });

                actions.appendChild(deleteBtn);
                item.appendChild(actions);
            } else {
                const nameSpan = document.createElement("span");
                nameSpan.textContent = player.name;
                item.appendChild(nameSpan);
                item.addEventListener("click", () => {
                    startEditingPlayer(index);
                });
            }
            playerListEl.appendChild(item);
        });

        countEl.textContent = `${players.length} 人`;
    }

    renderCOTable();
    renderScaleDayTabs();
    renderScaleList();
}

function populateSelect(select, selected) {
    select.innerHTML = "";

    const none = document.createElement("option");
    none.value = "";
    none.textContent = "なし";
    select.appendChild(none);

    players.forEach((player) => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = player.name;
        select.appendChild(option);
    });

    if (selected) {
        select.value = selected;
    }
}

function renderCOTable() {
    coTableEl.innerHTML = "";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    days.forEach((day) => {
        const th = document.createElement("th");
        th.textContent = day;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");

    roleRows.forEach((role, index) => {
        const tr = document.createElement("tr");
        const roleCell = document.createElement("th");
        const hasMenu = supportsRoleMenu(role.label);
        if (supportsAssignment(role.label) || hasMenu) {
            roleCell.className = hasMenu ? "role-cell role-cell-inline" : "role-cell";
            const headerContent = document.createElement("div");
            headerContent.className = "role-header-content";

            const roleLabelWrapper = document.createElement("div");
            const nameSizeClass = getRoleNameSizeClass(role.label);
            roleLabelWrapper.className = `role-name${nameSizeClass ? ` ${nameSizeClass}` : ""}`;

            roleLabelWrapper.textContent = role.label;
            headerContent.appendChild(roleLabelWrapper);

            if (hasMenu) {
                const actionWrapper = document.createElement("div");
                actionWrapper.className = "role-inline-actions";

                const addBtn = document.createElement("button");
                addBtn.type = "button";
                addBtn.className = "role-inline-btn add";
                addBtn.textContent = "+";
                addBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    addRoleRow(index);
                });

                const removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "role-inline-btn remove";
                removeBtn.textContent = "−";
                removeBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    removeRoleRow(index);
                });

                actionWrapper.appendChild(addBtn);
                actionWrapper.appendChild(removeBtn);
                headerContent.appendChild(actionWrapper);
            }

            if (supportsAssignment(role.label)) {
                const assignSelect = document.createElement("select");
                assignSelect.className = "role-assignment-select";
                populateSelect(assignSelect, roleAssignments[role.id]);
                assignSelect.addEventListener("change", () => {
                    const value = assignSelect.value;
                    if (value) {
                        roleAssignments[role.id] = value;
                    } else {
                        delete roleAssignments[role.id];
                    }
                    renderCOTable();
                });
                headerContent.appendChild(assignSelect);
            }

            roleCell.appendChild(headerContent);
        } else {
            roleCell.textContent = role.label;
        }
        tr.appendChild(roleCell);

        days.forEach((day) => {
            const td = document.createElement("td");
            const cellWrapper = document.createElement("div");
            cellWrapper.className = "co-cell-content";

            const select = document.createElement("select");
            select.dataset.role = role.id;
            select.dataset.day = day;
            const key = getKey(role.id, day);
            populateSelect(select, coSelections[key]);
            if (role.label === "吊り" || role.label === "噛み") {
                for (const option of select.options) {
                    option.disabled = !canRecordDeath(currentState(), role.id, day, option.value);
                }
            }
            select.addEventListener("change", (event) => {
                handleSelectionChange(role, day, event.target.value);
            });
            cellWrapper.appendChild(select);

            const shouldDisable = shouldDisableCell(role, day);
            select.disabled = shouldDisable;
            td.dataset.role = role.id;
            td.dataset.day = day;
            if (shouldDisable) {
                td.classList.add("disabled-cell");
            }

            if (supportsMarker(role.label)) {
                const markerKey = `${role.id}-${day}`;
                const markerButton = document.createElement("button");
                markerButton.type = "button";
                markerButton.className = "marker-toggle";
                markerButton.disabled = shouldDisable;
                const current = markerSelections[markerKey] || "white";
                updateMarkerAppearance(markerButton, current);
                markerButton.addEventListener("click", (event) => {
                    event.preventDefault();
                    const next = markerSelections[markerKey] === "black" ? "white" : "black";
                    markerSelections[markerKey] = next;
                    updateMarkerAppearance(markerButton, next);
                });
                cellWrapper.appendChild(markerButton);
            }

            td.appendChild(cellWrapper);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    coTableEl.appendChild(thead);
    coTableEl.appendChild(tbody);

    renderVotingTabs();
    renderScaleDayTabs();
}

playerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(playerForm);
    const name = formData.get("name").trim();

    if (!name) {
        return;
    }

    if (players.some((player) => player.name === name)) {
        window.alert("同じ名前のプレイヤーが既に存在します。");
        return;
    }
    const player = createPlayer(name);
    players.push(player);
    addPlayerToAllScales(player.id);
    playerForm.reset();
    renderPlayers();
});

if (openBulkModalBtn) {
    openBulkModalBtn.addEventListener("click", () => {
        openBulkModal();
    });
}

if (bulkModalClose) {
    bulkModalClose.addEventListener("click", () => {
        closeBulkModal();
    });
}

if (bulkCancelBtn) {
    bulkCancelBtn.addEventListener("click", () => {
        closeBulkModal();
    });
}

if (bulkModalEl) {
    bulkModalEl.addEventListener("click", (event) => {
        if (event.target === bulkModalEl) {
            closeBulkModal();
        }
    });
}

if (bulkSubmitBtn) {
    bulkSubmitBtn.addEventListener("click", () => {
        handleBulkAdd();
    });
}

if (openExportModalBtn) {
    const activateExportModal = () => {
        openExportModal();
    };
    openExportModalBtn.addEventListener("click", activateExportModal);
    openExportModalBtn.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }
        event.preventDefault();
        activateExportModal();
    });
}

if (exportModalClose) {
    exportModalClose.addEventListener("click", () => {
        closeExportModal();
    });
}

if (exportCancelBtn) {
    exportCancelBtn.addEventListener("click", () => {
        closeExportModal();
    });
}

if (exportSubmitBtn) {
    exportSubmitBtn.addEventListener("click", () => {
        handleExportSummary();
    });
}

if (exportModalEl) {
    exportModalEl.addEventListener("click", (event) => {
        if (event.target === exportModalEl) {
            closeExportModal();
        }
    });
}

if (openHelpModalBtn) {
    openHelpModalBtn.addEventListener("click", () => {
        openHelpModal();
    });
    openHelpModalBtn.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }
        event.preventDefault();
        openHelpModal();
    });
}

if (helpModalEl) {
    helpModalEl.addEventListener("click", (event) => {
        if (event.target === helpModalEl) {
            closeHelpModal();
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }

    if (bulkModalEl?.classList.contains("open")) {
        closeBulkModal();
        return;
    }

    if (exportModalEl?.classList.contains("open")) {
        closeExportModal();
        return;
    }

    if (helpModalEl?.classList.contains("open")) {
        closeHelpModal();
        return;
    }
    if (voteDrag) {
        voteDrag.cancel();
    } else if (cursors.pendingVoter) {
        cursors.pendingVoter = null;
        renderVotingContent();
    }
});

deleteVoteBtn.addEventListener("click", () => {
    if (!cursors.pendingVoter || !cursors.activeVotingDay) return;
    applyVotingChange(() => deleteVote(currentState(), cursors.activeVotingDay, cursors.pendingVoter));
    cursors.pendingVoter = null;
    renderVotingContent();
});

if (undoVoteBtn) {
    undoVoteBtn.addEventListener("click", () => {
        undoVotingChange();
    });
}

if (redoVoteBtn) {
    redoVoteBtn.addEventListener("click", () => {
        redoVotingChange();
    });
}

function openBulkModal() {
    if (!bulkModalEl) {
        return;
    }

    bulkModalEl.classList.add("open");
    bulkModalEl.setAttribute("aria-hidden", "false");
    if (bulkInputEl) {
        queueMicrotask(() => {
            bulkInputEl.focus();
            bulkInputEl.select();
        });
    }
}

function closeBulkModal() {
    if (!bulkModalEl) {
        return;
    }

    bulkModalEl.classList.remove("open");
    bulkModalEl.setAttribute("aria-hidden", "true");
}

function openExportModal() {
    if (!exportModalEl) {
        return;
    }

    exportModalEl.classList.add("open");
    exportModalEl.setAttribute("aria-hidden", "false");
    queueMicrotask(() => {
        exportResultInput?.focus();
    });
}

function closeExportModal() {
    if (!exportModalEl) {
        return;
    }

    exportModalEl.classList.remove("open");
    exportModalEl.setAttribute("aria-hidden", "true");
}

function openHelpModal() {
    if (!helpModalEl) {
        return;
    }

    helpModalEl.classList.add("open");
    helpModalEl.setAttribute("aria-hidden", "false");
}

function closeHelpModal() {
    if (!helpModalEl) {
        return;
    }

    helpModalEl.classList.remove("open");
    helpModalEl.setAttribute("aria-hidden", "true");
    openHelpModalBtn?.focus();
}

function initializeHelpModalContent() {
    if (!helpModalEl) {
        return;
    }

    fetch(HELP_CONTENT_PATH)
        .then((response) => {
            if (!response.ok) {
                throw new Error("failed to fetch help");
            }
            return response.text();
        })
        .then((html) => {
            helpModalEl.innerHTML = html;
            bindHelpModalCloseHandlers();
        })
        .catch(() => {
            helpModalEl.innerHTML = `
                <div class="modal help-modal">
                    <p class="help-intro">ヘルプを読み込めませんでした。ページを再読み込みしてみてください。</p>
                    <div class="modal-actions">
                        <button type="button" class="primary" data-help-close>閉じる</button>
                    </div>
                </div>`;
            bindHelpModalCloseHandlers();
        });
}

function bindHelpModalCloseHandlers() {
    if (!helpModalEl) {
        return;
    }

    const closeButtons = helpModalEl.querySelectorAll("[data-help-close]");
    closeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            closeHelpModal();
        });
    });
}

function handleExportSummary() {
    const resultText = exportResultInput?.value.trim() || "";
    const rolesText = exportRolesInput?.value.trim() || "";
    closeExportModal();
    exportMatchSummary({ resultText, rolesText });
}

function handleBulkAdd() {
    if (!bulkInputEl) {
        return;
    }

    const names = parseBulkInput(bulkInputEl.value);
    if (names.length === 0) {
        window.alert("登録できる名前が見つかりません。");
        return;
    }

    const uniqueNames = [...new Set(names)];
    const existing = new Set(players.map((player) => player.name));
    const added = [];
    const skipped = [];

    uniqueNames.forEach((name) => {
        if (existing.has(name)) {
            skipped.push(name);
            return;
        }
        const player = createPlayer(name);
        players.push(player);
        addPlayerToAllScales(player.id);
        existing.add(name);
        added.push(name);
    });

    if (added.length === 0) {
        window.alert("すべての名前が既に登録されています。");
        return;
    }

    bulkInputEl.value = "";
    closeBulkModal();
    renderPlayers();

    if (skipped.length > 0) {
        window.alert("一部の名前は既に登録されているため追加されませんでした。");
    }
}

function parseBulkInput(value) {
    if (!value) {
        return [];
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return [];
    }

    const delimiter = /[,\u3001\uFF0C\r\n]+/;
    return trimmed
        .split(delimiter)
        .map((item) => item.trim())
        .filter(Boolean);
}

function deletePlayer(index) {
    const target = players[index];
    if (!window.confirm(`${target.name} を削除しますか？`)) {
        return;
    }

    players.splice(index, 1);
    removePlayerReferences(currentState(), target.id);
    reconcileDeathRecords(currentState());
    syncAllMediumCells();
    updateVotingControls();
    if (cursors.editingPlayerIndex === index) {
        cursors.editingPlayerIndex = null;
    } else if (cursors.editingPlayerIndex !== null && cursors.editingPlayerIndex > index) {
        cursors.editingPlayerIndex -= 1;
    }
    renderPlayers();
}

function removeSelectionsForRole(roleId) {
    Object.keys(coSelections).forEach((key) => {
        if (key.startsWith(`${roleId}-`)) {
            delete coSelections[key];
        }
    });

    Object.keys(markerSelections).forEach((key) => {
        if (key.startsWith(`${roleId}-`)) {
            delete markerSelections[key];
        }
    });

    delete roleAssignments[roleId];
}

function startEditingPlayer(index) {
    cursors.editingPlayerIndex = index;
    renderPlayers();
}

function cancelEditingPlayer() {
    cursors.editingPlayerIndex = null;
    renderPlayers();
}

function finishEditingPlayer(index, newName, originalName) {
    if (!newName) {
        cancelEditingPlayer();
        return;
    }

    if (newName === originalName) {
        cancelEditingPlayer();
        return;
    }

    if (players.some((p, idx) => idx !== index && p.name === newName)) {
        window.alert("同じ名前のプレイヤーが既に存在します。");
        return;
    }

    players[index].name = newName;
    cursors.editingPlayerIndex = null;
    renderPlayers();
}

function clampScale(v) {
    if (Number.isNaN(v)) return 0.5;
    return Math.max(0, Math.min(1, v));
}

function applyThumbContrast(thumb, value) {
    thumb.classList.toggle("on-dark", value > 0.5);
}

function ensureScaleDay(day) {
    if (!day) return null;
    if (!playerScales[day]) {
        playerScales[day] = {};
    }
    return playerScales[day];
}

function getPopulatedScaleDays() {
    return days.filter((day, index) => index === 0 || Boolean(playerScales[day]));
}

function getActiveScaleDay(populatedDays) {
    const list = populatedDays || getPopulatedScaleDays();
    if (!cursors.activeScaleDay || !list.includes(cursors.activeScaleDay)) {
        cursors.activeScaleDay = list[list.length - 1] || null;
    }
    return cursors.activeScaleDay;
}

function getScaleValue(day, name) {
    return playerScales[day]?.[name];
}

function setScaleValue(day, name, value) {
    const scope = ensureScaleDay(day);
    if (!scope) return;
    scope[name] = value;
}

function ensureScaleDayPopulated(dayLabel) {
    if (!dayLabel || playerScales[dayLabel]) return;
    const dayIndex = days.indexOf(dayLabel);
    let sourceDay = null;
    if (dayIndex !== -1) {
        for (let i = dayIndex - 1; i >= 0; i--) {
            if (playerScales[days[i]]) {
                sourceDay = days[i];
                break;
            }
        }
    }
    if (sourceDay) {
        playerScales[dayLabel] = { ...playerScales[sourceDay] };
    } else {
        playerScales[dayLabel] = {};
    }
    players.forEach(({ id }) => {
        if (!(id in playerScales[dayLabel])) {
            playerScales[dayLabel][id] = 0.5;
        }
    });
    cursors.activeScaleDay = dayLabel;
}

function addPlayerToAllScales(name, value = 0.5) {
    Object.keys(playerScales).forEach((day) => {
        if (!(name in playerScales[day])) {
            playerScales[day][name] = value;
        }
    });
}

function setThumbValue(thumb, name, value) {
    const v = clampScale(value);
    const day = getActiveScaleDay();
    setScaleValue(day, name, v);
    thumb.style.setProperty("--scale-pos", `${v * 100}%`);
    thumb.setAttribute("aria-valuenow", v.toFixed(2));
    thumb.title = `${playerName(name)}: ${v.toFixed(2)}`;
    applyThumbContrast(thumb, v);
}

function attachScaleThumbInteractions(thumb, row, name) {
    let dragging = false;

    const updateFromClientX = (clientX) => {
        const rect = row.getBoundingClientRect();
        if (rect.width <= 0) return;
        setThumbValue(thumb, name, (clientX - rect.left) / rect.width);
    };

    thumb.addEventListener("pointerdown", (event) => {
        dragging = true;
        thumb.setPointerCapture(event.pointerId);
        thumb.classList.add("dragging");
        thumb.focus();
        event.preventDefault();
    });

    thumb.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        updateFromClientX(event.clientX);
    });

    const releasePointer = (event) => {
        if (!dragging) return;
        dragging = false;
        thumb.classList.remove("dragging");
        try {
            thumb.releasePointerCapture(event.pointerId);
        } catch (_) {}
    };
    thumb.addEventListener("pointerup", releasePointer);
    thumb.addEventListener("pointercancel", releasePointer);

    thumb.addEventListener("keydown", (event) => {
        const day = getActiveScaleDay();
        const current = clampScale(getScaleValue(day, name) ?? 0.5);
        const step = event.shiftKey ? 0.1 : 0.05;
        let next = current;
        switch (event.key) {
            case "ArrowRight":
            case "ArrowUp":
                next = current + step;
                break;
            case "ArrowLeft":
            case "ArrowDown":
                next = current - step;
                break;
            case "Home":
                next = 0;
                break;
            case "End":
                next = 1;
                break;
            default:
                return;
        }
        event.preventDefault();
        setThumbValue(thumb, name, next);
    });
}

function renderScaleDayTabs() {
    const tabsEl = document.getElementById("scaleDayTabs");
    if (!tabsEl) return;
    tabsEl.innerHTML = "";
    const populatedDays = getPopulatedScaleDays();
    const activeDay = getActiveScaleDay(populatedDays);
    populatedDays.forEach((day) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scale-day-tab";
        btn.textContent = `${day}夜`;
        btn.dataset.scaleDay = day;
        if (day === activeDay) {
            btn.classList.add("active");
        }
        btn.addEventListener("click", () => {
            cursors.activeScaleDay = day;
            renderScaleDayTabs();
            renderScaleList();
        });
        tabsEl.appendChild(btn);
    });
}

function renderScaleList() {
    const list = document.getElementById("scaleList");
    if (!list) {
        return;
    }
    const populatedDays = getPopulatedScaleDays();
    const day = getActiveScaleDay(populatedDays);
    if (players.length === 0) {
        list.classList.add("empty");
        list.innerHTML = '<p class="scale-empty">プレイヤーが登録されていません。</p>';
        return;
    }
    if (!day) {
        list.classList.add("empty");
        list.innerHTML = '<p class="scale-empty">CO 表に値を入力するとスケールが作成されます。</p>';
        return;
    }
    list.classList.remove("empty");
    list.innerHTML = "";
    players.forEach(({ id, name }) => {
        let stored = getScaleValue(day, id);
        if (stored === undefined) {
            stored = 0.5;
            setScaleValue(day, id, stored);
        }
        const value = clampScale(stored);

        const row = document.createElement("div");
        row.className = "scale-row";
        if (isAfterDeath(id, day)) {
            row.classList.add("dead");
        }

        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "scale-thumb";
        thumb.textContent = name;
        thumb.dataset.player = id;
        thumb.setAttribute("role", "slider");
        thumb.setAttribute("aria-valuemin", "0");
        thumb.setAttribute("aria-valuemax", "1");
        thumb.setAttribute("aria-label", `${name} の怪しさ (${day}夜)`);
        thumb.style.setProperty("--scale-pos", `${value * 100}%`);
        thumb.setAttribute("aria-valuenow", value.toFixed(2));
        thumb.title = `${name}: ${value.toFixed(2)}`;
        applyThumbContrast(thumb, value);

        attachScaleThumbInteractions(thumb, row, id);

        row.appendChild(thumb);
        list.appendChild(row);
    });
}

function attachCoTabHandlers() {
    const tabs = document.querySelectorAll(".co-tab");
    const panels = document.querySelectorAll(".co-tab-panel");
    tabs.forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.coTab;
            cursors.activeCoTab = target;
            tabs.forEach((b) => {
                const isActive = b.dataset.coTab === target;
                b.classList.toggle("active", isActive);
                b.setAttribute("aria-selected", isActive ? "true" : "false");
            });
            panels.forEach((p) => {
                p.hidden = p.dataset.coTab !== target;
            });
            if (target === "scale") {
                renderScaleDayTabs();
                renderScaleList();
            } else if (target === "voting") {
                renderVotingTabs();
            }
        });
    });
}

function autoAddDayIfNeeded(dayLabel, value) {
    if (!value) {
        return;
    }

    const index = days.indexOf(dayLabel);
    if (index === -1) {
        return;
    }

    if (index === days.length - 1) {
        addNextDay();
    }
}

function addNextDay() {
    const label = `${cursors.nextDayIndex}日目`;
    days.push(label);
    cursors.nextDayIndex += 1;
    renderCOTable();
}

function supportsMarker(label) {
    return label !== "吊り" && label !== "噛み";
}

function supportsAssignment(label) {
    return label !== "吊り" && label !== "噛み";
}

function shouldDisableCell(role, dayLabel) {
    if (!supportsAssignment(role.label)) {
        return false;
    }

    const assigned = roleAssignments[role.id];
    if (!assigned) {
        return false;
    }

    return isDeadBeforeDay(currentState(), assigned, dayLabel);
}

function isAfterDeath(playerName, dayLabel) {
    const record = deathRecords[playerName];
    if (!record) {
        return false;
    }

    const dayIndex = days.indexOf(dayLabel);
    if (dayIndex === -1) {
        return false;
    }

    return dayIndex >= record.dayIndex;
}

function handleSelectionChange(role, dayLabel, value) {
    const key = getKey(role.id, dayLabel);
    const deathRole = role.label === "吊り" || role.label === "噛み";
    if (deathRole && !canRecordDeath(currentState(), role.id, dayLabel, value)) {
        window.alert("この時点ですでに死亡しているプレイヤーは選べません。");
        renderCOTable();
        return;
    }
    if (value) {
        coSelections[key] = value;
        ensureScaleDayPopulated(dayLabel);
    } else {
        delete coSelections[key];
    }
    autoAddDayIfNeeded(dayLabel, value);
    if (deathRole) {
        const removed = reconcileDeathRecords(currentState());
        syncAllMediumCells();
        if (removed.length) {
            window.alert("死亡記録を日付順に確認し、重複する後続の死亡入力を解除しました。");
        }
    }
    renderCOTable();
    renderScaleList();
}

function updateMediumCellsForDay(targetDay, value) {
    roleRows.forEach((role) => {
        if (role.label !== "霊能者") {
            return;
        }

        const key = getKey(role.id, targetDay);
        if (value) {
            if (coSelections[key] !== value) {
                coSelections[key] = value;
                delete markerSelections[key];
            }
        } else if (coSelections[key]) {
            delete coSelections[key];
            delete markerSelections[key];
        }
    });

}

function syncNewMediumRow(newRole) {
    const lynchRoleId = findRoleIdByLabel("吊り");
    if (!lynchRoleId) {
        return;
    }

    days.forEach((day, index) => {
        const prevDay = days[index - 1];
        if (!prevDay) {
            return;
        }

        const sourceKey = getKey(lynchRoleId, prevDay);
        const value = coSelections[sourceKey];
        if (!value) {
            return;
        }

        const targetKey = getKey(newRole.id, day);
        coSelections[targetKey] = value;
    });

    renderCOTable();
}

function getRoleNameSizeClass(label) {
    if (!label) {
        return "";
    }

    if (label.length >= 8) {
        return "role-name-small";
    }

    if (label.length >= 6) {
        return "role-name-medium";
    }

    return "";
}

function findRoleIdByLabel(label) {
    const role = roleRows.find((item) => item.label === label);
    return role ? role.id : null;
}

function syncAllMediumCells() {
    const lynchRoleId = findRoleIdByLabel("吊り");
    if (!lynchRoleId) return;
    for (let i = 1; i < days.length; i += 1) {
        updateMediumCellsForDay(days[i], coSelections[getKey(lynchRoleId, days[i - 1])] || "");
    }
}

function supportsRoleMenu(label) {
    return label !== "吊り" && label !== "噛み";
}

function updateCellStyles(role, dayLabel, value) {
    const selector = `[data-role="${role.id}"][data-day="${dayLabel}"]`;
    const cell = coTableEl.querySelector(selector);
    if (!cell) {
        return;
    }

    if (shouldDisableCell(role, dayLabel)) {
        cell.classList.add("disabled-cell");
    } else {
        cell.classList.remove("disabled-cell");
    }
}

function renderVotingTabs() {
    const availableDays = getVotingDays();
    if (!cursors.activeVotingDay || !availableDays.includes(cursors.activeVotingDay)) {
        cursors.activeVotingDay = availableDays[0] || null;
    }

    votingTabsEl.innerHTML = "";

    availableDays.forEach((day) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "voting-tab";
        if (day === cursors.activeVotingDay) {
            button.classList.add("active");
        }
        button.textContent = day;
        button.addEventListener("click", () => {
            cursors.activeVotingDay = day;
            cursors.pendingVoter = null;
            renderVotingTabs();
        });
        votingTabsEl.appendChild(button);
    });

    renderVotingContent();
}

function renderVotingContent() {
    voteDrag?.cancel();
    voteEndpointController?.abort();
    voteResizeObserver?.disconnect();
    updateVotingControls();
    votingContentEl.innerHTML = "";

    if (!cursors.activeVotingDay) {
        votingContentEl.textContent = "表示できる日がありません。";
        return;
    }

    if (players.length === 0) {
        const empty = document.createElement("p");
        empty.className = "voting-empty";
        empty.textContent = "プレイヤーが登録されると投票管理が表示されます。";
        votingContentEl.appendChild(empty);
        return;
    }

    const container = document.createElement("div");
    container.className = "voting-layout";

    const visualWrapper = document.createElement("div");
    visualWrapper.className = "voting-visual";

    const rows = document.createElement("div");
    rows.className = "voting-rows";
    rows.appendChild(createVotingColumnHeader());

    const dayVotes = votingData[cursors.activeVotingDay] || {};

    players.forEach((player) => {
        const row = document.createElement("div");
        row.className = "voting-row";

        row.appendChild(createVotingItem(player.id, "voter", dayVotes));

        const connector = document.createElement("div");
        connector.className = "vote-connector";
        row.appendChild(connector);

        row.appendChild(createVotingItem(player.id, "target", dayVotes));

        rows.appendChild(row);
    });

    visualWrapper.appendChild(rows);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("voting-lines");
    visualWrapper.appendChild(svg);

    container.appendChild(visualWrapper);
    container.appendChild(renderVotingSummary(dayVotes));

    votingContentEl.appendChild(container);

    setupVotingInteractions(visualWrapper, dayVotes);
    drawVotingLines(visualWrapper, svg, dayVotes);
    if (typeof ResizeObserver !== "undefined") {
        voteResizeObserver = new ResizeObserver(() => {
            voteDrag?.cancel();
            drawVotingLines(visualWrapper, svg, dayVotes);
        });
        voteResizeObserver.observe(visualWrapper);
    }
}

function createVotingColumnHeader() {
    const header = document.createElement("div");
    header.className = "voting-row voting-header";

    const voterTitle = document.createElement("div");
    voterTitle.className = "voting-column-title voter-title";
    voterTitle.textContent = "投票者";

    const spacer = document.createElement("div");
    spacer.className = "vote-connector";

    const targetTitle = document.createElement("div");
    targetTitle.className = "voting-column-title target-title";
    targetTitle.textContent = "投票先";

    header.appendChild(voterTitle);
    header.appendChild(spacer);
    header.appendChild(targetTitle);
    return header;
}

function setupVotingInteractions(wrapper, dayVotes) {
    const dots = wrapper.querySelectorAll(".vote-dot");
    dots.forEach((dot) => {
        dot.addEventListener("mouseenter", () => {
            dot.classList.add("hover");
        });
        dot.addEventListener("mouseleave", () => {
            dot.classList.remove("hover");
        });
    });
}

function drawVotingLines(wrapper, svg, dayVotes) {
    voteEndpointController?.abort();
    wrapper.querySelectorAll(".vote-endpoint-dot").forEach((dot) => {
        dot.classList.remove("vote-endpoint-dot");
        dot.removeAttribute("title");
    });
    const rect = wrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    svg.replaceChildren();
    const entries = Object.entries(dayVotes);
    // Draw the selected connection last so its red outline stays visible at crossings.
    entries.sort(([a], [b]) => Number(a === cursors.pendingVoter) - Number(b === cursors.pendingVoter));
    for (const [voter, target] of entries) {
        const start = getDotCenter(wrapper, voter, "voter");
        const end = getDotCenter(wrapper, target, "target");
        if (!start || !end) continue;
        const selected = voter === cursors.pendingVoter;
        const group = document.createElementNS(svg.namespaceURI, "g");
        group.dataset.voter = voter;
        group.classList.toggle("selected-vote", selected);
        const makeLine = (className) => {
            const line = document.createElementNS(svg.namespaceURI, "line");
            line.setAttribute("x1", start.x);
            line.setAttribute("y1", start.y);
            line.setAttribute("x2", end.x);
            line.setAttribute("y2", end.y);
            line.classList.add(className);
            group.appendChild(line);
            return line;
        };
        const outline = makeLine("vote-connection-outline");
        const line = makeLine("vote-connection");
        const hit = makeLine("vote-connection-hit");
        // Keep the wider hit area away from the dots so shared targets remain clickable.
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        if (length > 30) {
            const dx = (end.x - start.x) / length * 15;
            const dy = (end.y - start.y) / length * 15;
            hit.setAttribute("x1", start.x + dx);
            hit.setAttribute("y1", start.y + dy);
            hit.setAttribute("x2", end.x - dx);
            hit.setAttribute("y2", end.y - dy);
        }
        hit.addEventListener("click", () => handleVoterClick(voter));
        svg.appendChild(group);
        if (selected) {
            const handle = document.createElementNS(svg.namespaceURI, "circle");
            handle.classList.add("vote-endpoint-handle");
            handle.setAttribute("cx", end.x);
            handle.setAttribute("cy", end.y);
            handle.setAttribute("r", "12");
            const title = document.createElementNS(svg.namespaceURI, "title");
            title.textContent = `${playerName(voter)}の投票先をドラッグして変更`;
            handle.appendChild(title);
            group.appendChild(handle);
            attachVoteEndpointDrag(handle, wrapper, line, outline, voter);
        }
    }
}

function attachVoteEndpointDrag(handle, wrapper, line, outline, voter) {
    const day = cursors.activeVotingDay;
    const originalTarget = votingData[day]?.[voter];
    const endpoint = wrapper.querySelector(`.vote-dot[data-side="target"][data-player="${originalTarget}"]`);
    if (!endpoint) return;
    endpoint.classList.add("vote-endpoint-dot");
    endpoint.title = "線の先端をドラッグして投票先を変更";
    voteEndpointController = new AbortController();
    const { signal } = voteEndpointController;
    let drag = null;
    let suppressClick = false;
    const clearCandidate = () => wrapper.querySelectorAll(".drop-candidate").forEach((dot) => dot.classList.remove("drop-candidate"));
    const drawEndpoint = (point) => {
        for (const segment of [line, outline]) {
            segment.setAttribute("x2", point.x);
            segment.setAttribute("y2", point.y);
        }
        handle.setAttribute("cx", point.x);
        handle.setAttribute("cy", point.y);
    };
    const findTarget = (clientX, clientY) => {
        if (isDeadBeforeDay(currentState(), voter, day)) return null;
        let closest = null;
        let distance = 26;
        for (const dot of wrapper.querySelectorAll('.vote-dot[data-side="target"]')) {
            if (isDeadBeforeDay(currentState(), dot.dataset.player, day)) continue;
            const rect = dot.getBoundingClientRect();
            const d = Math.hypot(clientX - rect.left - rect.width / 2, clientY - rect.top - rect.height / 2);
            if (d < distance) { closest = dot; distance = d; }
        }
        return closest;
    };
    const cancel = () => {
        if (!drag) return;
        const pointerId = drag.pointerId;
        drag = null;
        voteDrag = null;
        clearCandidate();
        wrapper.classList.remove("dragging-vote");
        const end = getDotCenter(wrapper, originalTarget, "target");
        if (end) drawEndpoint(end);
        if (endpoint.hasPointerCapture(pointerId)) endpoint.releasePointerCapture(pointerId);
    };
    endpoint.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        voteDrag?.cancel();
        suppressClick = false;
        drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        voteDrag = { cancel };
        wrapper.classList.add("dragging-vote");
        endpoint.setPointerCapture(event.pointerId);
    }, { signal });
    endpoint.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) {
            drag.moved = true;
            suppressClick = true;
        }
        clearCandidate();
        const candidate = findTarget(event.clientX, event.clientY);
        if (candidate) candidate.classList.add("drop-candidate");
        const rect = wrapper.getBoundingClientRect();
        drawEndpoint(candidate ? getDotCenter(wrapper, candidate.dataset.player, "target")
            : { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }, { signal });
    endpoint.addEventListener("pointerup", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const candidate = drag.moved ? findTarget(event.clientX, event.clientY) : null;
        cancel();
        if (candidate && cursors.activeVotingDay === day) handleTargetClick(candidate.dataset.player);
    }, { signal });
    endpoint.addEventListener("pointercancel", cancel, { signal });
    endpoint.addEventListener("lostpointercapture", cancel, { signal });
    endpoint.addEventListener("click", (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
    }, { capture: true, signal });
}

function getDotCenter(wrapper, playerName, side) {
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(playerName) : playerName.replace(/"/g, '\\"');
    const selector = `.vote-dot[data-side="${side}"][data-player="${escaped}"]`;
    const dot = wrapper.querySelector(selector);
    if (!dot) {
        return null;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    return {
        x: dotRect.left - wrapperRect.left + dotRect.width / 2,
        y: dotRect.top - wrapperRect.top + dotRect.height / 2,
    };
}

function createVotingItem(name, side, dayVotes) {
    const item = document.createElement("div");
    item.className = "voting-item";
    if (side === "voter") {
        item.classList.add("voting-item-left");
    }
    if (cursors.activeVotingDay && isDeadBeforeDay(currentState(), name, cursors.activeVotingDay)) {
        item.classList.add("dead");
    }

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "vote-dot";
    dot.setAttribute("aria-label", `${playerName(name)}を${side === "voter" ? "投票者" : "投票先"}に選択`);
    dot.dataset.player = name;
    dot.dataset.side = side;

    if (side === "voter") {
        if (cursors.pendingVoter === name) {
            dot.classList.add("pending");
        }

        if (dayVotes[name]) {
            item.classList.add("has-vote");
        }

        dot.addEventListener("click", () => handleVoterClick(name));
    } else {
        const targeted = Object.values(dayVotes).includes(name);
        if (targeted) {
            item.classList.add("targeted");
        }

        dot.addEventListener("click", () => handleTargetClick(name));
    }

    const label = document.createElement("span");
    label.className = "vote-name";
    label.textContent = playerName(name);

    item.appendChild(dot);
    item.appendChild(label);
    return item;
}

function handleVoterClick(name) {
    if (cursors.pendingVoter === name) {
        cursors.pendingVoter = null;
    } else {
        cursors.pendingVoter = name;
    }

    renderVotingContent();
}

function handleTargetClick(targetName) {
    if (!cursors.pendingVoter || !cursors.activeVotingDay) return;
    const existing = votingData[cursors.activeVotingDay]?.[cursors.pendingVoter];
    if (existing !== targetName) {
        const changed = applyVotingChange(() => setVote(
            currentState(), cursors.activeVotingDay, cursors.pendingVoter, targetName
        ));
        if (!changed) window.alert("前日までに死亡したプレイヤーへの投票・投票者への指定はできません。");
    }
    cursors.pendingVoter = null;
    renderVotingContent();
}

function cloneVotingData() {
    return JSON.parse(JSON.stringify(votingData));
}

function applyVotingChange(mutator) {
    const snapshot = cloneVotingData();
    const changed = mutator();
    if (!changed) {
        return false;
    }

    votingHistory.push(snapshot);
    if (votingHistory.length > 100) {
        votingHistory.shift();
    }
    setVotingFuture([]);
    updateVotingControls();
    return true;
}

function undoVotingChange() {
    if (votingHistory.length === 0) {
        return;
    }

    votingFuture.push(cloneVotingData());
    setVotingData(votingHistory.pop());
    cursors.pendingVoter = null;
    renderVotingTabs();
    updateVotingControls();
}

function redoVotingChange() {
    if (votingFuture.length === 0) {
        return;
    }

    votingHistory.push(cloneVotingData());
    setVotingData(votingFuture.pop());
    cursors.pendingVoter = null;
    renderVotingTabs();
    updateVotingControls();
}

function updateVotingControls() {
    deleteVoteBtn.disabled = !votingData[cursors.activeVotingDay]?.[cursors.pendingVoter];
    if (!undoVoteBtn || !redoVoteBtn) {
        return;
    }

    undoVoteBtn.disabled = votingHistory.length === 0;
    redoVoteBtn.disabled = votingFuture.length === 0;
}

let lastSummaryDay = null;
let lastSummaryCount = 0;

function renderVotingSummary(dayVotes) {
    const summary = document.createElement("div");
    summary.className = "voting-summary";

    const tableWrap = document.createElement("div");
    tableWrap.className = "voting-summary-scroll";

    const table = document.createElement("table");
    table.className = "voting-summary-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["投票者", "投票先", "投票数"].forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    const entries = Object.entries(dayVotes);

    const currentDay = cursors.activeVotingDay;
    const shouldScrollToBottom =
        currentDay !== null &&
        currentDay === lastSummaryDay &&
        entries.length > lastSummaryCount;
    lastSummaryDay = currentDay;
    lastSummaryCount = entries.length;

    if (entries.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.textContent = "投票がまだありません。";
        row.appendChild(cell);
        tbody.appendChild(row);
    } else {
        const targetCounts = computeTargetCounts(entries);

        entries.forEach(([voter, target]) => {
            const row = document.createElement("tr");
            row.dataset.voter = voter;
            row.classList.toggle("selected-vote-row", voter === cursors.pendingVoter);
            row.addEventListener("click", () => handleVoterClick(voter));
            if (
                currentDay &&
                (isDeadBeforeDay(currentState(), voter, currentDay) || isDeadBeforeDay(currentState(), target, currentDay))
            ) {
                row.classList.add("dead");
            }
            const voterCell = document.createElement("td");
            const selectVote = document.createElement("button");
            selectVote.type = "button";
            selectVote.className = "vote-history-select";
            selectVote.textContent = playerName(voter);
            selectVote.setAttribute("aria-label", `${playerName(voter)}の投票を修正`);
            voterCell.appendChild(selectVote);
            const targetCell = document.createElement("td");
            targetCell.textContent = playerName(target);
            const countCell = document.createElement("td");
            const count = targetCounts[target];
            if (count && count > 1) {
                const order = getVoteOrder(entries, target, voter);
                countCell.textContent = `${order}票目 / ${count}票`;
            } else {
                countCell.textContent = count ? "1票目" : "-";
            }

            row.appendChild(voterCell);
            row.appendChild(targetCell);
            row.appendChild(countCell);
            tbody.appendChild(row);
        });
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    summary.appendChild(tableWrap);

    if (shouldScrollToBottom) {
        requestAnimationFrame(() => {
            tableWrap.scrollTop = tableWrap.scrollHeight;
        });
    }

    return summary;
}

function computeTargetCounts(entries) {
    const counts = {};
    entries.forEach(([, target]) => {
        counts[target] = (counts[target] || 0) + 1;
    });
    return counts;
}

function getVoteOrder(entries, target, voter) {
    let order = 0;
    for (const [currentVoter, currentTarget] of entries) {
        if (currentTarget === target) {
            order += 1;
        }
        if (currentVoter === voter) {
            return order;
        }
    }
    return order;
}

function getVotingDays() {
    return days.filter((day) => {
        const num = parseInt(day, 10);
        if (Number.isNaN(num)) {
            return true;
        }
        return num > 0;
    });
}

function updateMarkerAppearance(button, color) {
    button.dataset.color = color;
    button.setAttribute("aria-label", color === "black" ? "黒丸" : "白丸");
}

function addRoleRow(index) {
    const source = roleRows[index];
    const newRole = { id: `role-${cursors.nextRoleId}`, label: source.label };
    cursors.nextRoleId += 1;
    roleRows.splice(index + 1, 0, newRole);
    renderCOTable();
    if (source.label === "霊能者") {
        syncNewMediumRow(newRole);
    }
}

function removeRoleRow(index) {
    if (roleRows.length === 1) {
        window.alert("これ以上削除できません。");
        return;
    }

    const target = roleRows[index];
    roleRows.splice(index, 1);
    removeSelectionsForRole(target.id);
    renderCOTable();
}

addRoleBtn.addEventListener("click", () => {
    const name = window.prompt("追加する役職名を入力してください");
    if (name === null) {
        return;
    }

    const label = name.trim();
    if (!label) {
        return;
    }

    const exists = roleRows.some((role) => role.label === label);
    if (exists) {
        window.alert("同じ名前の役職が既に存在します。");
        return;
    }

    const newRole = { id: `role-${cursors.nextRoleId}`, label };
    cursors.nextRoleId += 1;
    roleRows.push(newRole);
    renderCOTable();
});

if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
        const current = getActiveTheme();
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        storeTheme(next);
    });
}

function saveCurrentMatch() {
    clearTimeout(saveTimer);
    if (!archiveWritable) return false;
    const match = matchArchive.matches.find((item) => item.id === matchArchive.activeMatchId);
    match.state = structuredClone({ ...currentState(),
        cursors: { ...cursors, pendingVoter: null, editingPlayerIndex: null },
        memoText: memoTextarea.value, resultText: exportResultInput.value, rolesText: exportRolesInput.value,
    });
    match.updatedAt = new Date().toISOString();
    try {
        localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(matchArchive));
        saveStatus.textContent = "";
        saveStatus.classList.remove("save-error");
        return true;
    } catch {
        saveStatus.textContent = "保存できません。空き容量やブラウザの保存設定を確認してください。";
        saveStatus.classList.add("save-error");
        return false;
    }
}

function openMatch(id) {
    const match = matchArchive.matches.find((item) => item.id === id);
    if (!match) return;
    matchArchive.activeMatchId = id;
    restoreState(match.state);
    reconcileDeathRecords(currentState());
    memoTextarea.value = match.state.memoText;
    exportResultInput.value = match.state.resultText;
    exportRolesInput.value = match.state.rolesText;
    playerForm.reset();
    bulkInputEl.value = "";
    lastSummaryDay = null;
    lastSummaryCount = 0;
    renderPlayers();
    updateVotingControls();
    document.querySelectorAll(".co-tab").forEach((tab) => {
        const active = tab.dataset.coTab === cursors.activeCoTab;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".co-tab-panel").forEach((panel) => {
        panel.hidden = panel.dataset.coTab !== cursors.activeCoTab;
    });
    matchSelect.replaceChildren();
    for (const item of matchArchive.matches) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.title;
        option.selected = item.id === id;
        matchSelect.appendChild(option);
    }
}

function initializeMatches() {
    let raw = null;
    try { raw = localStorage.getItem(MATCHES_STORAGE_KEY); } catch { /* Saving reports storage errors below. */ }
    try {
        matchArchive = parseArchive(raw);
    } catch {
        // Keep the original stored bytes intact if a future version or damaged data is encountered.
        matchArchive = createArchive();
        archiveWritable = false;
        saveStatus.textContent = "保存データを読み込めません。元データの上書きを停止しています。";
        saveStatus.classList.add("save-error");
        newMatchBtn.disabled = true;
    }
    openMatch(matchArchive.activeMatchId);
    if (archiveWritable) saveCurrentMatch();
    matchSelect.addEventListener("change", () => {
        const nextId = matchSelect.value;
        saveCurrentMatch();
        openMatch(nextId);
        saveCurrentMatch();
    });
    newMatchBtn.addEventListener("click", () => {
        saveCurrentMatch();
        const next = createMatch(matchArchive.matches.length + 1, players);
        matchArchive.matches.push(next);
        openMatch(next.id);
        saveCurrentMatch();
    });
    // Run after each interaction's handlers; pointer movement is saved on release.
    for (const event of ["input", "change", "click", "keydown", "pointerup", "pointercancel"]) {
        document.addEventListener(event, () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(saveCurrentMatch, 120);
        }, true);
    }
    window.addEventListener("pagehide", saveCurrentMatch);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") saveCurrentMatch();
    });
}

initializeHelpModalContent();
attachCoTabHandlers();
initializeMatches();
initializeThemePreference();

function getActiveTheme() {
    return document.documentElement.dataset.theme || "light";
}

function initializeThemePreference() {
    const stored = getStoredTheme();
    if (stored) {
        applyTheme(stored);
        return;
    }

    const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
}

function applyTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = normalized;
    if (themeToggleBtn) {
        const isDark = normalized === "dark";
        themeToggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
        themeToggleBtn.setAttribute(
            "aria-label",
            isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"
        );
    }
}

function storeTheme(theme) {
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // ignore storage failures
    }
}

function getStoredTheme() {
    try {
        return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
        return null;
    }
}

function exportMatchSummary({ resultText, rolesText }) {
    const exportedAt = formatExportTimestamp(new Date());
    const data = buildSummaryData({ resultText, rolesText, exportedAt });
    const pages = renderSummaryPages(data);
    const pdfContent = assemblePdfFromImages(pages);
    triggerPdfDownload(pdfContent);
}

function buildSummaryData({ resultText, rolesText, exportedAt }) {
    const memoText = (memoTextarea?.value || "").trim();

    const coHeaders = ["役職", ...days];
    const coRows = roleRows.map((role) => {
        const assignment = supportsAssignment(role.label) && roleAssignments[role.id]
            ? playerName(roleAssignments[role.id])
            : "";
        const rows = days.map((day) => {
            const id = coSelections[getKey(role.id, day)];
            const value = id ? playerName(id) : "-";
            const marker = getMarkerSymbol(role.id, day, value);
            if (!marker) {
                return value;
            }

            if (!value || value === "-") {
                return marker;
            }

            return `${value} ${marker}`;
        });
        const label = assignment ? `${role.label}\n${assignment}` : role.label;
        return [label, ...rows];
    });

    const voteDays = getVotingDays().map((day) => {
        const entries = Object.entries(votingData[day] || {});
        if (entries.length === 0) {
            return { day, rows: [] };
        }
        const counts = computeTargetCounts(entries);
        const rows = entries.map(([voter, target]) => {
            const count = counts[target] || 1;
            const orderText = count > 1 ? `${getVoteOrder(entries, target, voter)}票目 / ${count}票` : "1票目";
            return [playerName(voter), playerName(target), orderText];
        });
        return { day, rows };
    });

    return {
        coTable: { headers: coHeaders, rows: coRows },
        votes: voteDays,
        memoText: memoText || "メモは記録されていません。",
        resultText: (resultText || "").trim() || "未入力",
        rolesText: (rolesText || "").trim() || "未入力",
        exportedAt: exportedAt || formatExportTimestamp(new Date())
    };
}

function getMarkerSymbol(roleId, day, value) {
    const key = `${roleId}-${day}`;
    const marker = markerSelections[key];
    if (marker === "black") {
        return "●";
    }

    if (marker === "white") {
        return "○";
    }

    if (value && value !== "-") {
        return "○";
    }

    return "";
}

function triggerPdfDownload(pdfContent) {
    const blob = pdfContent instanceof Blob ? pdfContent : new Blob([pdfContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `jinro-summary-${timestamp}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function renderSummaryPages(data) {
    const canvasWidth = 1240;
    const canvasHeight = 1754;
    const marginX = 80;
    const marginTop = 80;
    const marginBottom = 80;
    const contentWidth = canvasWidth - marginX * 2;
    const fonts = {
        reportTitle: '600 48px "Noto Sans JP", "Yu Gothic", sans-serif',
        sectionTitle: '600 34px "Noto Sans JP", "Yu Gothic", sans-serif',
        subheading: '600 28px "Noto Sans JP", "Yu Gothic", sans-serif',
        tableHeader: '600 24px "Noto Sans JP", "Yu Gothic", sans-serif',
        tableCell: '400 22px "Noto Sans JP", "Yu Gothic", sans-serif',
        paragraph: '400 24px "Noto Sans JP", "Yu Gothic", sans-serif',
        memo: '400 26px "Noto Sans JP", "Yu Gothic", sans-serif',
        caption: '400 22px "Noto Sans JP", "Yu Gothic", sans-serif'
    };
    const lineHeights = {
        tableHeader: 30,
        tableCell: 30,
        paragraph: 34,
        memo: 36
    };
    const cellPadding = 12;
    const pages = [];

    let { canvas, ctx } = createSummaryCanvas(canvasWidth, canvasHeight);
    let currentY = marginTop;

    const availableHeight = () => canvasHeight - marginBottom - currentY;
    const commitPage = () => {
        pages.push(convertCanvasToPage(canvas));
        ({ canvas, ctx } = createSummaryCanvas(canvasWidth, canvasHeight));
        currentY = marginTop;
    };

    const ensureSpace = (height) => {
        if (height <= availableHeight()) {
            return;
        }
        commitPage();
    };

    const drawReportHeader = () => {
        ensureSpace(80);
        ctx.font = fonts.reportTitle;
        ctx.fillStyle = "#0f172a";
        const titleBase = data.exportedAt ? `試合まとめ: ${data.exportedAt}` : "試合まとめ";
        const resultLabel = data.resultText ? `（結果: ${data.resultText}）` : "";
        ctx.fillText(`${titleBase} ${resultLabel}`.trim(), marginX, currentY);
        currentY += 64;
        ctx.fillStyle = "#1f2937";
    };

    const drawSectionTitle = (text) => {
        ensureSpace(60);
        ctx.font = fonts.sectionTitle;
        ctx.fillStyle = "#0f172a";
        ctx.fillText(text, marginX, currentY);
        currentY += 46;
        drawDivider();
    };

    const drawDivider = () => {
        ctx.strokeStyle = "#cbd5f5";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marginX, currentY);
        ctx.lineTo(canvasWidth - marginX, currentY);
        ctx.stroke();
        currentY += 12;
        ctx.fillStyle = "#1f2937";
    };

    const wrapLines = (text, width, font, lineHeightValue) => {
        ctx.save();
        ctx.font = font;
        const chars = Array.from(text || "");
        const lines = [];
        let current = "";
        chars.forEach((char) => {
            const test = current + char;
            if (ctx.measureText(test).width <= width) {
                current = test;
            } else if (current) {
                lines.push(current);
                current = char;
            } else {
                lines.push(char);
                current = "";
            }
        });
        if (current) {
            lines.push(current);
        }
        ctx.restore();
        if (lines.length === 0) {
            lines.push("");
        }
        return {
            lines,
            height: lines.length * lineHeightValue
        };
    };

    const wrapWithLineBreaks = (text, width, font, lineHeightValue) => {
        const segments = (text ?? "").split(/\r?\n/);
        const collected = [];
        segments.forEach((segment, index) => {
            const layout = wrapLines(segment, width, font, lineHeightValue);
            collected.push(...layout.lines);
            if (index !== segments.length - 1) {
                collected.push("");
            }
        });
        if (collected.length === 0) {
            collected.push("");
        }
        return {
            lines: collected,
            height: collected.length * lineHeightValue
        };
    };

    const drawTable = (table) => {
        if (!table.rows.length) {
            drawParagraph("データがありません。");
            return;
        }

        const columnWidths = computeColumnWidths(table.headers.length, contentWidth);
        const headerLayout = table.headers.map((text, index) =>
            wrapLines(text, columnWidths[index] - cellPadding * 2, fonts.tableHeader, lineHeights.tableHeader)
        );
        const headerHeight = getRowHeight(headerLayout, lineHeights.tableHeader, cellPadding);

        const drawHeaderRow = () => {
            ensureSpace(headerHeight);
            drawRow(table.headers, headerLayout, columnWidths, {
                font: fonts.tableHeader,
                lineHeight: lineHeights.tableHeader,
                fill: "#f1f5f9",
                bold: true
            });
        };

        drawHeaderRow();

        table.rows.forEach((row) => {
            const layouts = row.map((text, index) =>
                wrapLines(text || "", columnWidths[index] - cellPadding * 2, fonts.tableCell, lineHeights.tableCell)
            );
            const rowHeight = getRowHeight(layouts, lineHeights.tableCell, cellPadding);
            if (rowHeight > availableHeight()) {
                commitPage();
                drawHeaderRow();
            }
            ensureSpace(rowHeight);
            drawRow(row, layouts, columnWidths, {
                font: fonts.tableCell,
                lineHeight: lineHeights.tableCell
            });
        });

        currentY += 24;
    };

    const drawRow = (cells, layouts, widths, options) => {
        const rowHeight = getRowHeight(layouts, options.lineHeight, cellPadding);
        let x = marginX;
        ctx.strokeStyle = "#cbd5f5";
        ctx.lineWidth = 1;
        ctx.font = options.font;
        ctx.fillStyle = "#0f172a";
        cells.forEach((cell, index) => {
            const width = widths[index];
            ctx.fillStyle = options.fill || "#ffffff";
            ctx.fillRect(x, currentY, width, rowHeight);
            ctx.strokeRect(x, currentY, width, rowHeight);
            ctx.fillStyle = "#0f172a";
            ctx.font = options.font;
            const lines = layouts[index].lines;
            let textY = currentY + cellPadding;
            lines.forEach((line) => {
                ctx.fillText(line, x + cellPadding, textY);
                textY += options.lineHeight;
            });
            x += width;
        });
        currentY += rowHeight;
    };

    const drawParagraph = (text, indent = 0) => {
        const maxWidth = contentWidth - indent;
        const layout = wrapLines(text, maxWidth, fonts.paragraph, lineHeights.paragraph);
        const blockHeight = layout.height;
        ensureSpace(blockHeight);
        ctx.font = fonts.paragraph;
        ctx.fillStyle = "#1f2937";
        let textY = currentY;
        layout.lines.forEach((line) => {
            ctx.fillText(line, marginX + indent, textY);
            textY += lineHeights.paragraph;
        });
        currentY += blockHeight + 20;
    };

    const drawMemoBlock = (text) => {
        const layout = wrapWithLineBreaks(text, contentWidth - cellPadding * 2, fonts.memo, lineHeights.memo);
        const boxHeight = layout.height + cellPadding * 2;
        ensureSpace(boxHeight);
        ctx.fillStyle = "#eef2ff";
        ctx.fillRect(marginX, currentY, contentWidth, boxHeight);
        ctx.fillStyle = "#0f172a";
        ctx.font = fonts.memo;
        let textY = currentY + cellPadding;
        layout.lines.forEach((line) => {
            ctx.fillText(line, marginX + cellPadding, textY);
            textY += lineHeights.memo;
        });
        currentY += boxHeight + 24;
    };

    const drawVoteSections = (votes) => {
        if (!votes.length) {
            drawParagraph("投票情報がありません。");
            return;
        }

        votes.forEach((entry) => {
            ensureSpace(50);
            ctx.font = fonts.subheading;
            ctx.fillStyle = "#0f172a";
            ctx.fillText(entry.day, marginX, currentY);
            currentY += 38;
            if (entry.rows.length === 0) {
                drawParagraph("投票なし", 20);
                return;
            }
            const table = {
                headers: ["投票者", "投票先", "票順"],
                rows: entry.rows
            };
            drawTable(table);
        });
    };

    const drawResultSection = (result, roles) => {
        const blocks = [
            { label: "試合結果", value: result },
            { label: "正解の配役", value: roles }
        ];
        blocks.forEach((block) => {
            const layout = wrapWithLineBreaks(block.value, contentWidth - cellPadding * 2, fonts.paragraph, lineHeights.paragraph);
            const boxHeight = layout.height + cellPadding * 2 + 34;
            ensureSpace(boxHeight);
            ctx.fillStyle = "#f8fafc";
            ctx.fillRect(marginX, currentY, contentWidth, boxHeight);
            ctx.strokeStyle = "#cbd5f5";
            ctx.strokeRect(marginX, currentY, contentWidth, boxHeight);
            ctx.fillStyle = "#0f172a";
            ctx.font = fonts.subheading;
            ctx.fillText(block.label, marginX + cellPadding, currentY + cellPadding);
            ctx.font = fonts.paragraph;
            let textY = currentY + cellPadding + 30;
            layout.lines.forEach((line) => {
                ctx.fillText(line, marginX + cellPadding, textY);
                textY += lineHeights.paragraph;
            });
            currentY += boxHeight + 20;
        });
    };

    drawReportHeader();
    drawSectionTitle("CO表");
    drawTable(data.coTable);
    drawSectionTitle("メモ");
    drawMemoBlock(data.memoText);
    drawSectionTitle("投票状況");
    drawVoteSections(data.votes);
    drawSectionTitle("配役 / 試合結果");
    drawResultSection(data.resultText, data.rolesText);

    pages.push(convertCanvasToPage(canvas));
    return pages;
}

function formatExportTimestamp(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "";
    }
    const pad = (value) => String(value).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
}

function computeColumnWidths(count, totalWidth) {
    if (count <= 0) {
        return [];
    }
    if (count === 1) {
        return [totalWidth];
    }
    const first = Math.min(260, totalWidth * 0.3);
    const remaining = Math.max(totalWidth - first, 200);
    const others = (remaining) / (count - 1);
    const widths = [];
    for (let i = 0; i < count; i += 1) {
        widths.push(i === 0 ? first : others);
    }
    return widths;
}

function getRowHeight(layouts, lineHeight, padding) {
    if (!layouts.length) {
        return lineHeight + padding * 2;
    }
    const heights = layouts.map((layout) => layout.height + padding * 2);
    return Math.max(...heights);
}

function createSummaryCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("2D コンテキストを初期化できません");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.font = '400 24px "Noto Sans JP", "Yu Gothic", sans-serif';
    ctx.textBaseline = "top";

    return { canvas, ctx };
}

function convertCanvasToPage(canvas) {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    return {
        width: canvas.width,
        height: canvas.height,
        data: dataUrlToUint8Array(dataUrl)
    };
}

function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function assemblePdfFromImages(pages) {
    const encoder = new TextEncoder();
    const pdfChunks = [];
    let position = 0;
    const pushChunk = (chunk) => {
        pdfChunks.push(chunk);
        position += chunk.length;
    };

    const header = encoder.encode("%PDF-1.4\n");
    pushChunk(header);
    const xrefEntries = ["0000000000 65535 f \n"];

    const pageCount = pages.length || 1;
    const totalObjects = 2 + pageCount * 3;
    const pageObjectIds = [];
    const contentObjectIds = [];
    const imageObjectIds = [];

    let nextId = 3;
    for (let i = 0; i < pageCount; i += 1) {
        pageObjectIds.push(nextId);
        contentObjectIds.push(nextId + 1);
        imageObjectIds.push(nextId + 2);
        nextId += 3;
    }

    const objectMap = new Map();
    objectMap.set(1, [`<< /Type /Catalog /Pages 2 0 R >>`]);
    const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
    objectMap.set(2, [`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`]);

    pages.forEach((page, index) => {
        const pageId = pageObjectIds[index];
        const contentId = contentObjectIds[index];
        const imageId = imageObjectIds[index];
        const imageName = `/Im${index}`;

        objectMap.set(
            pageId,
            [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << ${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]
        );

        const contentStream = `q 595 0 0 842 0 0 cm ${imageName} Do Q`;
        objectMap.set(
            contentId,
            [`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`]
        );

        objectMap.set(
            imageId,
            [
                `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`,
                page.data,
                "\nendstream"
            ]
        );
    });

    for (let i = 1; i <= totalObjects; i += 1) {
        const parts = objectMap.get(i) || [""];
        const offsetEntry = `${position.toString().padStart(10, "0")} 00000 n \n`;
        xrefEntries.push(offsetEntry);
        pushChunk(encoder.encode(`${i} 0 obj\n`));
        parts.forEach((part) => {
            if (typeof part === "string") {
                pushChunk(encoder.encode(part));
            } else {
                pushChunk(part);
            }
        });
        pushChunk(encoder.encode("\nendobj\n"));
    }

    const xrefStart = position;
    pushChunk(encoder.encode(`xref\n0 ${totalObjects + 1}\n`));
    xrefEntries.forEach((entry) => {
        pushChunk(encoder.encode(entry));
    });
    pushChunk(encoder.encode(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));

    const totalLength = pdfChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    pdfChunks.forEach((chunk) => {
        merged.set(chunk, offset);
        offset += chunk.length;
    });

    return merged;
}
