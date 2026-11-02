export function createPdf(data) {
    return assemblePdfFromImages(renderSummaryPages(data));
}

export function renderSummaryPages(data) {
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
        const title = [data.sessionName, data.matchTitle || "試合まとめ"].filter(Boolean).join(" / ");
        const layout = wrapLines(title, contentWidth, fonts.reportTitle, 58);
        for (const line of layout.lines) {
            ensureSpace(58);
            ctx.font = fonts.reportTitle;
            ctx.fillStyle = "#0f172a";
            ctx.fillText(line, marginX, currentY);
            currentY += 58;
        }
        currentY += 12;
        drawParagraph([`試合日: ${data.matchDate}`, data.gmName ? `GM: ${data.gmName}` : ""].filter(Boolean).join("\n"));
    };

    const drawSectionTitle = (text) => {
        ensureSpace(130);
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
        segments.forEach((segment) => {
            const layout = wrapLines(segment, width, font, lineHeightValue);
            collected.push(...layout.lines);
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
            wrapWithLineBreaks(text, columnWidths[index] - cellPadding * 2, fonts.tableHeader, lineHeights.tableHeader)
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
                wrapWithLineBreaks(text || "", columnWidths[index] - cellPadding * 2, fonts.tableCell, lineHeights.tableCell)
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
        const layout = wrapWithLineBreaks(text, contentWidth - indent, fonts.paragraph, lineHeights.paragraph);
        for (const line of layout.lines) {
            ensureSpace(lineHeights.paragraph);
            ctx.font = fonts.paragraph;
            ctx.fillStyle = "#1f2937";
            ctx.fillText(line, marginX + indent, currentY);
            currentY += lineHeights.paragraph;
        }
        currentY += 20;
    };

    const drawTextBox = (text, label = "", font = fonts.memo, lineHeight = lineHeights.memo, fill = "#eef2ff") => {
        const { lines } = wrapWithLineBreaks(text, contentWidth - cellPadding * 2, font, lineHeight);
        let index = 0;
        while (index < lines.length) {
            const labelHeight = label ? 38 : 0;
            ensureSpace(labelHeight + cellPadding * 2 + lineHeight);
            const count = Math.max(1, Math.floor((availableHeight() - labelHeight - cellPadding * 2) / lineHeight));
            const chunk = lines.slice(index, index + count);
            const height = labelHeight + cellPadding * 2 + chunk.length * lineHeight;
            ctx.fillStyle = fill;
            ctx.fillRect(marginX, currentY, contentWidth, height);
            ctx.fillStyle = "#0f172a";
            if (label) {
                ctx.font = fonts.subheading;
                ctx.fillText(label + (index ? "（続き）" : ""), marginX + cellPadding, currentY + cellPadding);
            }
            ctx.font = font;
            chunk.forEach((line, i) => ctx.fillText(line, marginX + cellPadding, currentY + cellPadding + labelHeight + i * lineHeight));
            currentY += height + 24;
            index += chunk.length;
            if (index < lines.length) commitPage();
        }
    };
    const drawMemoBlock = (text) => drawTextBox(text);

    const drawScaleSections = (scales) => {
        if (!scales.length) { drawParagraph("スケールは記録されていません。"); return; }
        const labelWidth = 320;
        const trackX = marginX + labelWidth + 20;
        const trackWidth = contentWidth - labelWidth - 120;
        for (const entry of scales) {
            const drawDayHeader = (continued = false) => {
                ensureSpace(150);
                ctx.fillStyle = "#0f172a";
                ctx.font = fonts.subheading;
                ctx.fillText(`${entry.day}夜${continued ? "（続き）" : ""}`, marginX, currentY);
                currentY += 42;
                ctx.font = fonts.caption;
                ctx.fillText("白寄り 0", trackX, currentY);
                ctx.textAlign = "right";
                ctx.fillText("黒寄り 1", trackX + trackWidth, currentY);
                ctx.textAlign = "left";
                currentY += 34;
            };
            drawDayHeader();
            if (!entry.rows.length) { drawParagraph("プレイヤーが登録されていません。"); continue; }
            for (const row of entry.rows) {
                const label = row.name + (row.dead ? "（死亡）" : "");
                const layout = wrapLines(label, labelWidth, fonts.tableCell, lineHeights.tableCell);
                const height = Math.max(58, layout.height + 16);
                if (height > availableHeight()) { commitPage(); drawDayHeader(true); }
                ctx.fillStyle = row.dead ? "#64748b" : "#0f172a";
                ctx.font = fonts.tableCell;
                layout.lines.forEach((line, i) => ctx.fillText(line, marginX, currentY + 8 + i * lineHeights.tableCell));
                const y = currentY + height / 2;
                const gradient = ctx.createLinearGradient(trackX, 0, trackX + trackWidth, 0);
                gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(1, "#0f172a");
                ctx.fillStyle = gradient;
                ctx.fillRect(trackX, y - 6, trackWidth, 12);
                ctx.strokeStyle = "#94a3b8";
                ctx.lineWidth = 1;
                ctx.strokeRect(trackX, y - 6, trackWidth, 12);
                ctx.beginPath();
                ctx.arc(trackX + row.value * trackWidth, y, 8, 0, Math.PI * 2);
                ctx.fillStyle = "#0f172a";
                ctx.fill();
                ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = "#0f172a";
                ctx.fillText(row.value.toFixed(2), trackX + trackWidth + 18, y - 15);
                currentY += height;
            }
            currentY += 20;
        }
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
        drawTextBox(result, "試合結果", fonts.paragraph, lineHeights.paragraph, "#f8fafc");
        drawTextBox(roles, "正解の配役", fonts.paragraph, lineHeights.paragraph, "#f8fafc");
    };

    drawReportHeader();
    drawSectionTitle("CO表");
    drawTable(data.coTable);
    drawSectionTitle("メモ");
    drawMemoBlock(data.memoText);
    drawSectionTitle("投票状況");
    drawVoteSections(data.votes);
    drawSectionTitle("スケール");
    drawScaleSections(data.scales || []);
    drawSectionTitle("配役 / 試合結果");
    drawResultSection(data.resultText, data.rolesText);

    pages.push(convertCanvasToPage(canvas));
    return pages;
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
