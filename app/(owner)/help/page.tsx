import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileDown,
  FileText,
  Headphones,
  KeyRound,
  Link2,
  LockKeyhole,
  Mic,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  VolumeX,
} from "lucide-react";

export const metadata: Metadata = { title: "Как это работает" };

const steps = [
  {
    number: "01",
    icon: Smartphone,
    title: "Подключите приложение",
    text: "В приложении AI Recorder на Android или Mac укажите адрес базы и токен приёма. Они находятся в «Настройках» этого сайта.",
    hint: "Один токен на все ваши устройства. Пока — вручную, позже сделаем подключение по QR.",
  },
  {
    number: "02",
    icon: Mic,
    title: "Запишите встречу или звонок",
    text: "Приложение записывает звук и отправляет его в сервис расшифровки. Аудио при этом остаётся у вас и на сайте.",
    hint: "Если в приложении включено «удалять аудио после расшифровки», плеера на сайте не будет.",
  },
  {
    number: "03",
    icon: RefreshCw,
    title: "Дождитесь текста и отчёта",
    text: "После расшифровки приходят фразы с таймкодами, говорящие, умное название, теги и отчёт: итоги, решения, задачи.",
    hint: "Всё это синхронизируется с сайтом — вместе с правками имён, тегов и меток.",
  },
  {
    number: "04",
    icon: Headphones,
    title: "Откройте запись на сайте",
    text: "В кабинете слушайте запись, листайте расшифровку, переходите к фразе по клику и смотрите отчёт в соседней вкладке.",
    hint: "Поиск ищет по названию, тегам, тексту расшифровки и отчёту.",
  },
  {
    number: "05",
    icon: Share2,
    title: "Создайте ссылку с паролем",
    text: "На странице записи нажмите «Поделиться», задайте пароль и срок. Пароль можно оставить пустым — сайт сгенерирует его сам.",
    hint: "Ссылку можно отозвать, вернуть или сменить пароль в любой момент.",
  },
  {
    number: "06",
    icon: KeyRound,
    title: "Передайте ссылку и пароль отдельно",
    text: "Отправьте ссылку в одном сообщении, пароль — в другом или голосом. Так ссылка не откроется тому, кто увидел только переписку.",
    hint: "Пароль показывается один раз при создании. Если забыли — задайте новый.",
  },
  {
    number: "07",
    icon: LockKeyhole,
    title: "Получатель открывает запись",
    text: "По ссылке он вводит пароль и получает только эту запись: плеер, расшифровку, отчёт и PDF. Кабинет и другие записи закрыты.",
    hint: "Скачивания аудио в интерфейсе нет — только прослушивание.",
  },
];

const checks = [
  "Название, теги, расшифровка, отчёт, имена говорящих, метки и подсказки",
  "Правки на сайте и на устройстве не затирают друг друга: побеждает последняя",
  "Удаление записи доезжает до всех устройств и отзывает ссылки",
  "Аудио публикуется с того устройства, где записано, и хранится на сайте",
];

export default function HelpPage() {
  return (
    <div className="fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-400 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.9} />
        К записям
      </Link>

      <div className="mt-5 max-w-2xl">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-400">сценарий</p>
        <h1 className="mt-2 font-display text-[38px] font-medium leading-[0.98] tracking-[-0.04em] text-ink sm:text-[46px]">
          Как это работает
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-500">
          От записи на телефоне до ссылки, которую можно отправить клиенту. Семь шагов — и запись
          можно слушать, читать и показывать.
        </p>
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <section key={step.number} className="card-flat relative overflow-hidden p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-white">
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="mono text-[10px] text-ink-200">{step.number}</span>
              </div>
              <h2 className="mt-4 font-display text-[18px] font-medium tracking-[-0.02em] text-ink">
                {step.title}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">{step.text}</p>
              <p className="mt-3 border-t border-hairline pt-2.5 text-[10.5px] leading-relaxed text-ink-300">
                {step.hint}
              </p>
            </section>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
            <ShieldCheck className="size-4 text-ink-400" strokeWidth={1.8} />
            <h2 className="text-[13px] font-medium text-ink">Полная синхронизация</h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            <p className="text-[12px] leading-relaxed text-ink-500">
              Сайт и приложения обмениваются всей библиотекой, а не только списком:
            </p>
            <ul className="space-y-2">
              {checks.map((item) => (
                <li key={item} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-500">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
            <LockKeyhole className="size-4 text-ink-400" strokeWidth={1.8} />
            <h2 className="text-[13px] font-medium text-ink">Что видит получатель</h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-2 text-[12px] text-ink-500">
              <Link2 className="size-3.5 text-orange-text" strokeWidth={2} />
              Открывает ссылку и вводит пароль
            </div>
            <div className="flex items-center gap-2 text-[12px] text-ink-500">
              <Headphones className="size-3.5 text-orange-text" strokeWidth={2} />
              Слушает запись и переходит по фразам
            </div>
            <div className="flex items-center gap-2 text-[12px] text-ink-500">
              <FileText className="size-3.5 text-orange-text" strokeWidth={2} />
              Читает расшифровку и отчёт
            </div>
            <div className="flex items-center gap-2 text-[12px] text-ink-500">
              <FileDown className="size-3.5 text-orange-text" strokeWidth={2} />
              Открывает PDF с отчётом и текстом
            </div>
            <p className="mt-2 border-t border-hairline pt-3 text-[10.5px] leading-relaxed text-ink-300">
              Аккаунт получателю не нужен. Ссылка открывает одну запись, даже если у владельца их
              сотни.
            </p>
          </div>
        </section>
      </div>

      <section className="card-flat mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-tint text-orange-text">
            <VolumeX className="size-4" strokeWidth={1.9} />
          </span>
          <div>
            <p className="text-[13px] font-medium text-ink">Если аудио уже удалено</p>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-ink-400">
              Сайт покажет расшифровку и отчёт, но без плеера. Чтобы аудио появлялось на сайте,
              в приложении должно быть включено сохранение аудио после расшифровки.
            </p>
          </div>
        </div>
        <Link href="/settings" className="btn btn-outline btn-sm shrink-0">
          Настройки подключения
          <ArrowRight className="size-3.5" strokeWidth={1.9} />
        </Link>
      </section>

      <div className="mt-7 flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary">
          К записям
          <ArrowRight className="size-4" strokeWidth={1.9} />
        </Link>
        <Link href="/settings" className="btn btn-outline">
          Адрес и токен для приложения
        </Link>
      </div>
    </div>
  );
}
