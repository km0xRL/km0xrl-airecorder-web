import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { Recording } from "@/lib/types";
import { formatDateRu, formatDuration, kindLabel } from "@/lib/format";
import { buildDisplaySegments } from "@/lib/speakers";
import { safeFileName } from "@/lib/http";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 44;

const INK = "#0A0A0A";
const INK_700 = "#262626";
const INK_500 = "#525252";
const INK_400 = "#737373";
const INK_300 = "#A3A3A3";
const HAIRLINE = "#E5E5E5";
const ORANGE = "#FF4D00";
const ORANGE_TEXT = "#E63F00";
const ORANGE_TINT = "#FFF4EE";

interface Fonts {
  display: string;
  body: string;
  mono: string;
}

function registerFonts(doc: PDFKit.PDFDocument): Fonts {
  const root = process.cwd();
  const fonts = {
    display: path.join(root, "assets", "fonts", "onest.ttf"),
    body: path.join(root, "assets", "fonts", "golos-text.ttf"),
    mono: path.join(root, "assets", "fonts", "jetbrains-mono.ttf"),
  };
  doc.registerFont("Display", fs.readFileSync(fonts.display));
  doc.registerFont("Body", fs.readFileSync(fonts.body));
  doc.registerFont("Mono", fs.readFileSync(fonts.mono));
  return { display: "Display", body: "Body", mono: "Mono" };
}

function plainMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_~`>]/g, "")
    .replace(/^\s*[-+]\s+/gm, "— ")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function renderRecordingPdf(recording: Recording): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: 64, left: MARGIN, right: MARGIN },
      bufferPages: true,
      // Не грузим стандартный Helvetica: в standalone-сборке его AFM-файлов нет,
      // а весь документ набирается зарегистрированными Onest/Golos/Mono.
      font: "",
      info: {
        Title: recording.title,
        Author: "AI Recorder",
        Subject: recording.report?.summary[0] ?? "Отчёт о встрече",
        Creator: "AI Recorder Web",
      },
    });
    const fonts = registerFonts(doc);
    const display = (size: number) => doc.font(fonts.display).fontSize(size).fillColor(INK);
    const body = (size: number) => doc.font(fonts.body).fontSize(size).fillColor(INK_700);
    const mono = (size: number) => doc.font(fonts.mono).fontSize(size).fillColor(INK_400);

    const segments = buildDisplaySegments(
      recording.transcript,
      recording.speakerNames,
      recording.speakerOverrides,
      recording.marks,
    );
    const tags = recording.tags.slice(0, 12);
    const dateMs = recording.recordedAtMs ?? recording.createdAtMs;
    const meta = [
      formatDateRu(dateMs),
      formatDuration(recording.durationS),
      kindLabel(recording.kind),
      recording.originDevice,
    ].filter(Boolean) as string[];

    const drawPageTop = () => {
      const previousY = doc.y;
      doc.save();
      doc.moveTo(MARGIN, 34).lineTo(MARGIN + 22, 34).lineWidth(2).strokeColor(ORANGE).stroke();
      doc
        .font(fonts.mono)
        .fontSize(6.5)
        .fillColor(INK_400)
        .text("AI RECORDER", MARGIN + 28, 30, { characterSpacing: 1.4 });
      doc
        .font(fonts.body)
        .fontSize(7.5)
        .fillColor(INK_300)
        .text(recording.title.slice(0, 90), MARGIN + 28, 30, {
          width: CONTENT_W - 28,
          align: "right",
          lineBreak: false,
        });
      doc.restore();
      doc.y = Math.max(MARGIN, previousY || MARGIN);
    };

    // Колонтитул на каждой новой странице, включая автоматические разрывы PDFKit.
    doc.on("pageAdded", () => {
      drawPageTop();
      doc.y = MARGIN;
    });

    const ensureSpace = (height: number) => {
      const bottom = PAGE_H - 72;
      if (doc.y + height > bottom) {
        doc.addPage();
      }
    };

    // --- Обложка-шапка ---
    doc.save();
    doc.rect(MARGIN, MARGIN, 28, 3).fill(ORANGE);
    doc.restore();
    doc
      .font(fonts.mono)
      .fontSize(7)
      .fillColor(INK_400)
      .text("AI RECORDER · ОТЧЁТ О ВСТРЕЧЕ", MARGIN + 38, MARGIN - 1, { characterSpacing: 1.6 });

    doc.y = MARGIN + 26;
    display(24).text(recording.title, MARGIN, doc.y, { width: CONTENT_W, lineGap: 1 });
    doc.moveDown(0.55);
    mono(8.5).fillColor(INK_400).text(meta.join("  ·  "), MARGIN, doc.y, { width: CONTENT_W });

    if (tags.length) {
      doc.moveDown(0.75);
      let x = MARGIN;
      let y = doc.y;
      for (const tag of tags) {
        const label = `#${tag}`.slice(0, 40);
        body(7.5).fillColor(ORANGE_TEXT);
        const width = doc.widthOfString(label) + 14;
        if (x + width > MARGIN + CONTENT_W) {
          x = MARGIN;
          y += 22;
        }
        doc.save().roundedRect(x, y, width, 17, 8.5).fill(ORANGE_TINT).restore();
        doc.fillColor(ORANGE_TEXT).font(fonts.body).fontSize(7.5).text(label, x + 7, y + 5, {
          lineBreak: false,
        });
        x += width + 6;
      }
      doc.y = y + 26;
    }

    doc.moveDown(0.6);
    doc.save().moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).lineWidth(0.6).strokeColor(HAIRLINE).stroke().restore();
    doc.y += 20;

    const sectionTitle = (title: string, hint?: string) => {
      ensureSpace(120);
      doc.save().rect(MARGIN, doc.y + 3, 5, 5).fill(ORANGE).restore();
      display(13).text(title, MARGIN + 12, doc.y, { width: CONTENT_W - 12 });
      if (hint) {
        doc
          .font(fonts.mono)
          .fontSize(6.5)
          .fillColor(INK_300)
          .text(hint, MARGIN + 12, doc.y + 2, { width: CONTENT_W - 12, align: "right" });
      }
      doc.y += 6;
      doc.save().moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).lineWidth(0.5).strokeColor(HAIRLINE).stroke().restore();
      doc.y += 12;
    };

    const paragraph = (text: string, options?: { indent?: number; size?: number; color?: string }) => {
      const size = options?.size ?? 10;
      const width = CONTENT_W - (options?.indent ?? 0);
      body(size).fillColor(options?.color ?? INK_700);
      const height = doc.heightOfString(text, { width, lineGap: 2 });
      ensureSpace(height + 8);
      doc.text(text, MARGIN + (options?.indent ?? 0), doc.y, { width, lineGap: 2 });
      doc.y += 7;
    };

    const report = recording.report;
    if (report) {
      if (report.summary.length) {
        sectionTitle("Итоги", `${report.summary.length}`);
        for (const item of report.summary) {
          const height = doc.heightOfString(item, { width: CONTENT_W - 16, lineGap: 2 });
          ensureSpace(height + 8);
          doc.save().circle(MARGIN + 3.5, doc.y + 5.5, 2).fill(ORANGE).restore();
          body(10).fillColor(INK_700).text(item, MARGIN + 16, doc.y, { width: CONTENT_W - 16, lineGap: 2 });
          doc.y += 6;
        }
        doc.y += 16;
      }

      if (report.decisions.length) {
        sectionTitle("Решения", `${report.decisions.length}`);
        report.decisions.forEach((item, index) => {
          const label = String(index + 1).padStart(2, "0");
          const height = Math.max(
            doc.heightOfString(item, { width: CONTENT_W - 36, lineGap: 2 }),
            13,
          );
          ensureSpace(height + 10);
          const top = doc.y;
          doc.font(fonts.mono).fontSize(8).fillColor(ORANGE_TEXT).text(label, MARGIN, top + 1, { width: 22 });
          body(10).fillColor(INK_700).text(item, MARGIN + 30, top, { width: CONTENT_W - 30, lineGap: 2 });
          doc.y += 7;
        });
        doc.y += 16;
      }

      if (report.tasks.length) {
        sectionTitle("Задачи", `${report.tasks.length}`);
        for (const task of report.tasks) {
          const detail = [task.assignee, task.due ? `до ${task.due}` : null].filter(Boolean).join(" · ");
          const height = doc.heightOfString(task.title, { width: CONTENT_W - 24, lineGap: 2 }) + (detail ? 13 : 0);
          ensureSpace(height + 12);
          const top = doc.y;
          doc.save().roundedRect(MARGIN, top + 1.5, 8, 8, 1.5).lineWidth(0.8).strokeColor(INK_300).stroke().restore();
          body(10).fillColor(INK).text(task.title, MARGIN + 20, top, { width: CONTENT_W - 20, lineGap: 2 });
          if (detail) {
            doc.font(fonts.body).fontSize(8).fillColor(INK_400).text(detail, MARGIN + 20, doc.y + 1, {
              width: CONTENT_W - 20,
            });
          }
          doc.y += 8;
        }
        doc.y += 12;
      }

      if (!report.summary.length && !report.decisions.length && !report.tasks.length && report.markdown) {
        sectionTitle("Отчёт");
        paragraph(plainMarkdown(report.markdown), { size: 10 });
      }

      if (report.markdown && (report.summary.length || report.decisions.length || report.tasks.length)) {
        const clean = plainMarkdown(report.markdown);
        const alreadyCovered =
          clean &&
          (clean.includes(report.summary[0] ?? "\u0000") || clean.length < 80);
        if (clean && !alreadyCovered) {
          ensureSpace(170);
          doc.y += 6;
          sectionTitle("Протокол");
          for (const block of clean.split(/\n{2,}/)) {
            paragraph(block.trim(), { size: 10 });
            doc.y += 4;
          }
        }
      }
    }

    if (recording.hints.length) {
      ensureSpace(180);
      sectionTitle("Стоило спросить", `${recording.hints.length}`);
      for (const hint of recording.hints.slice(0, 20)) {
        const text = hint.text?.trim();
        if (!text) continue;
        const quote = hint.quote?.trim();
        const height =
          doc.heightOfString(text, { width: CONTENT_W - 28, lineGap: 1.5 }) +
          (quote ? doc.heightOfString(`«${quote}»`, { width: CONTENT_W - 28 }) + 4 : 0) +
          16;
        ensureSpace(height + 8);
        const top = doc.y;
        doc.save().rect(MARGIN, top, 2.5, height - 2).fill(ORANGE).restore();
        doc.font(fonts.body).fontSize(9.5).fillColor(INK_700).text(text, MARGIN + 14, top, {
          width: CONTENT_W - 28,
          lineGap: 1.5,
        });
        if (quote) {
          doc.font(fonts.body).fontSize(8.5).fillColor(INK_400).text(`«${quote}»`, MARGIN + 14, doc.y + 2, {
            width: CONTENT_W - 28,
          });
        }
        doc.y += 12;
      }
      doc.y += 10;
    }

    // --- Расшифровка ---
    doc.addPage();
    doc.y = MARGIN + 10;
    display(17).text("Расшифровка встречи", MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.3);
    mono(7.5)
      .fillColor(INK_400)
      .text(
        `${segments.length ? `${segments.length} фраз` : "сплошной текст"}  ·  ${formatDuration(recording.durationS)}`,
        MARGIN,
        doc.y,
      );
    doc.y += 16;
    doc.save().moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).lineWidth(0.6).strokeColor(HAIRLINE).stroke().restore();
    doc.y += 16;

    if (segments.length) {
      const textX = MARGIN + 52;
      const textW = CONTENT_W - 52;
      for (const segment of segments) {
        const speakerHeight = 13;
        const textHeight = doc.heightOfString(segment.text, { width: textW - 10, lineGap: 2 });
        const blockHeight = speakerHeight + textHeight + 14;
        ensureSpace(blockHeight + 4);
        const top = doc.y;
        if (segment.marked) {
          doc.save().roundedRect(MARGIN - 6, top, CONTENT_W + 12, blockHeight - 4, 3).fill(ORANGE_TINT).restore();
          doc.save().rect(MARGIN - 6, top, 2, blockHeight - 4).fill(ORANGE).restore();
        }
        doc
          .font(fonts.mono)
          .fontSize(7.5)
          .fillColor(segment.marked ? ORANGE_TEXT : INK_300)
          .text(formatDuration(segment.start), MARGIN, top + 1, { width: 44, align: "right" });
        doc
          .font(fonts.display)
          .fontSize(8)
          .fillColor(INK_500)
          .text(segment.name.slice(0, 80), textX, top, { width: textW, lineBreak: false });
        doc
          .font(fonts.body)
          .fontSize(9.5)
          .fillColor(INK_700)
          .text(segment.text, textX, top + speakerHeight, { width: textW - 10, lineGap: 2 });
        doc.y = top + blockHeight;
      }
    } else if (recording.transcript?.text) {
      for (const paragraphText of recording.transcript.text.split(/\n{2,}/)) {
        paragraph(paragraphText.trim(), { size: 10 });
        doc.y += 6;
      }
    } else {
      body(10).fillColor(INK_400).text("Расшифровки пока нет.", MARGIN, doc.y);
    }

    // --- Подвал: номера страниц ---
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = range.start; i < range.start + total; i += 1) {
      doc.switchToPage(i);
      const previousBottom = doc.page.margins.bottom;
      // Подвал лежит ниже обычного нижнего поля: без этого PDFKit добавляет страницу.
      doc.page.margins.bottom = 0;
      doc.save().moveTo(MARGIN, FOOTER_Y - 8).lineTo(MARGIN + CONTENT_W, FOOTER_Y - 8).lineWidth(0.5).strokeColor(HAIRLINE).stroke().restore();
      doc
        .font(fonts.mono)
        .fontSize(6.5)
        .fillColor(INK_300)
        .text("AI RECORDER", MARGIN, FOOTER_Y, { characterSpacing: 1.1, lineBreak: false });
      doc
        .font(fonts.body)
        .fontSize(7)
        .fillColor(INK_300)
        .text(`${i + 1} / ${total}`, MARGIN, FOOTER_Y, {
          width: CONTENT_W,
          align: "right",
          lineBreak: false,
        });
      doc.page.margins.bottom = previousBottom;
    }

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function pdfFileName(recording: Recording): string {
  return `${safeFileName(recording.title, "Отчёт")}.pdf`;
}

export { chunkArray, plainMarkdown };
