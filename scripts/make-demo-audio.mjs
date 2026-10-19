#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "data", "demo");
fs.mkdirSync(dir, { recursive: true });

const lines = [
  ["Спикер 1", "Коллеги, начинаем планёрку по релизу AI Recorder. Сегодня три вопроса: сроки, хранение аудио и доступ по ссылке."],
  ["Спикер 2", "По срокам: сервер и веб-кабинет готовы, осталось подключить отправку аудио из приложения. Предлагаю релиз двадцатого сентября."],
  ["Спикер 1", "Двадцатое подходит. Успеем ли сделать ссылки с паролем и PDF к этому дню?"],
  ["Спикер 2", "Ссылки уже работают, PDF собирается на сервере. Проверим на реальной записи и закроем задачу."],
  ["Спикер 1", "Хорошо. Второй вопрос — хранение аудио. Где оно будет лежать?"],
  ["Спикер 2", "На Railway volume, в отдельной папке. Метаданные в SQLite, файлы рядом. На тарифе Pro есть ежедневный бэкап."],
  ["Спикер 1", "А если том закончится?"],
  ["Спикер 2", "Следим за размером в настройках, лимит файла пятьсот мегабайт. Если понадобится, переедем на S3 — контракт API не изменится."],
  ["Спикер 1", "Принято. Третий вопрос — что видит получатель ссылки?"],
  ["Спикер 2", "Плеер, расшифровку с таймкодами, отчёт и PDF. Скачивания аудио нет, только прослушивание в браузере."],
  ["Спикер 1", "Пароль на каждую ссылку?"],
  ["Спикер 2", "Да, свой пароль и срок жизни. Ссылку можно отозвать или сменить пароль в любой момент."],
  ["Спикер 1", "Отлично. Фиксируем: релиз двадцатого, ссылки и PDF в первую очередь, аудио на volume."],
  ["Спикер 2", "Я подготовлю чек-лист и пришлю в Telegram. Ещё добавлю демо-запись, чтобы проверить вёрстку."],
  ["Спикер 1", "Спасибо, на этом всё."],
];

const voices = execFileSync("say", ["-v", "?"], { encoding: "utf8" });
if (!voices.includes("Milena")) {
  console.error("Нужен русский голос Milena в macOS: Системные настройки → Универсальный доступ → Устная речь.");
  process.exit(1);
}

execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });

const silencePath = path.join(dir, "silence.aiff");
execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", "0.32", "-c:a", "pcm_s16le", silencePath], { stdio: "ignore" });

const duration = (file) =>
  Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], {
      encoding: "utf8",
    }).trim(),
  );

const parts = [];
const segments = [];
let cursor = 0.45;
const introPath = path.join(dir, "intro.aiff");
execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", String(cursor), "-c:a", "pcm_s16le", introPath], { stdio: "ignore" });
parts.push(introPath);

lines.forEach(([speaker, text], index) => {
  const raw = path.join(dir, `line-${String(index + 1).padStart(2, "0")}.aiff`);
  execFileSync("say", ["-v", "Milena", "-r", speaker === "Спикер 1" ? "188" : "176", "-o", raw, text]);
  let file = raw;
  if (speaker === "Спикер 2") {
    const shifted = path.join(dir, `line-${String(index + 1).padStart(2, "0")}-shift.aiff`);
    execFileSync("ffmpeg", ["-y", "-i", raw, "-af", "asetrate=22050*1.075,aresample=22050,atempo=0.93", "-c:a", "pcm_s16le", shifted], { stdio: "ignore" });
    file = shifted;
  }
  const length = duration(file);
  segments.push({
    start: Math.round(cursor * 1000) / 1000,
    end: Math.round((cursor + length) * 1000) / 1000,
    speaker,
    text,
  });
  parts.push(file);
  cursor += length;
  if (index < lines.length - 1) {
    parts.push(silencePath);
    cursor += 0.32;
  }
});

const outroPath = path.join(dir, "outro.aiff");
execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", "0.8", "-c:a", "pcm_s16le", outroPath], { stdio: "ignore" });
parts.push(outroPath);
cursor += 0.8;

const concatPath = path.join(dir, "concat.txt");
fs.writeFileSync(concatPath, parts.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n") + "\n");

const audioPath = path.join(dir, "meeting.m4a");
execFileSync(
  "ffmpeg",
  ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c:a", "aac", "-b:a", "64k", "-ar", "22050", "-ac", "1", audioPath],
  { stdio: "ignore" },
);

const total = duration(audioPath);
const manifest = {
  audio: "meeting.m4a",
  total_s: Math.round(total * 1000) / 1000,
  segments,
};
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

for (const file of fs.readdirSync(dir)) {
  if (file.endsWith(".aiff") || file === "concat.txt") fs.rmSync(path.join(dir, file), { force: true });
}

console.log(`Демо-аудио: ${audioPath}`);
console.log(`Длительность: ${Math.round(total)} с, фраз: ${segments.length}`);
console.log(`Манифест: ${path.join(dir, "manifest.json")}`);
