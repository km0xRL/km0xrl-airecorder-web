import type { Hint, MeetingReport, Transcript } from "@/lib/types";

export interface SearchTextFields {
  title: string;
  sourceName?: string | null;
  tags: string[];
  transcript?: Transcript | null;
  report?: MeetingReport | null;
  speakerNames?: Record<string, string>;
  speakerOverrides?: Record<string, string>;
  hints?: Hint[];
}

/** Один нормализованный текст для поиска: название, файл, теги, речь, отчёт, говорящие и подсказки. */
export function buildSearchText(fields: SearchTextFields): string {
  const report = fields.report;
  const parts: string[] = [
    fields.title,
    fields.sourceName ?? "",
    ...fields.tags,
    fields.transcript?.text ?? "",
    ...(fields.transcript?.segments ?? []).map((segment) => `${segment.speaker ?? ""} ${segment.text}`),
    report?.title ?? "",
    ...(report?.summary ?? []),
    ...(report?.decisions ?? []),
    ...(report?.tasks ?? []).flatMap((task) => [task.title, task.assignee ?? "", task.due ?? ""]),
    report?.markdown ?? "",
    ...(report?.tags ?? []),
    ...Object.values(fields.speakerNames ?? {}),
    ...Object.values(fields.speakerOverrides ?? {}),
    ...(fields.hints ?? []).flatMap((hint) => [hint.text, hint.quote ?? ""]),
  ];
  return parts
    .join("\n")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ")
    .trim();
}
