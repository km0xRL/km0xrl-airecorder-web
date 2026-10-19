import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://localhost:3000";
const recordingId = process.env.DEMO_RID || "5b796724-1c5e-483d-a9e3-c5f83594a948";
const shareToken = process.env.DEMO_TOKEN || "KEOR_2hH9r0f0e3ukoU9-vGqDWGHDjmMmMzBpLn-FMA";
const ownerPassword = process.env.OWNER_PASSWORD || "demo-owner-2026";
const sharePassword = process.env.DEMO_SHARE_PASSWORD || "demo2026";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ executablePath: chrome, headless: true });

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage });
  console.log(`screenshot: ${name}.png`);
}

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ru-RU",
  reducedMotion: "reduce",
});
const page = await desktop.newPage();
page.on("pageerror", (error) => console.error("[pageerror]", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.error("[console]", message.text());
});

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await settle(page);
await shot(page, "01-login");

await page.fill("#password", ownerPassword);
await page.click("button[type=submit]");
await page.waitForURL(`${base}/`, { timeout: 15000 });
await settle(page);
await shot(page, "02-dashboard");

await page.goto(`${base}/recordings/${recordingId}`, { waitUntil: "domcontentloaded" });
await settle(page);
await shot(page, "03-recording-report");
await shot(page, "03-recording-report-full", true);

const transcriptTab = page.getByRole("tab", { name: /Расшифровка/ });
if (await transcriptTab.count()) {
  await transcriptTab.click();
  await settle(page);
  await shot(page, "04-recording-transcript");
}

const share = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ru-RU",
  reducedMotion: "reduce",
});
const sharePage = await share.newPage();
sharePage.on("pageerror", (error) => console.error("[share pageerror]", error.message));
await sharePage.goto(`${base}/s/${shareToken}`, { waitUntil: "domcontentloaded" });
await settle(sharePage);
await shot(sharePage, "05-share-locked");

await sharePage.fill("#password", sharePassword);
await sharePage.click("button[type=submit]");
await sharePage.waitForFunction(() => document.body.innerText.includes("Планёрка"), null, { timeout: 15000 });
await settle(sharePage);
await shot(sharePage, "06-share-report");

const shareTranscript = sharePage.getByRole("tab", { name: /Расшифровка/ });
if (await shareTranscript.count()) {
  await shareTranscript.click();
  await settle(sharePage);
  await shot(sharePage, "07-share-transcript");
}

const state = await share.storageState();
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "ru-RU",
  reducedMotion: "reduce",
  storageState: state,
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(`${base}/s/${shareToken}`, { waitUntil: "domcontentloaded" });
await settle(mobilePage);
await shot(mobilePage, "08-share-mobile");
const mobileTranscript = mobilePage.getByRole("tab", { name: /Расшифровка/ });
if (await mobileTranscript.count()) {
  await mobileTranscript.click();
  await settle(mobilePage);
  await shot(mobilePage, "09-share-mobile-transcript");
}

const mobileOwner = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "ru-RU",
  reducedMotion: "reduce",
});
const ownerMobilePage = await mobileOwner.newPage();
await ownerMobilePage.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await ownerMobilePage.fill("#password", ownerPassword);
await ownerMobilePage.click("button[type=submit]");
await ownerMobilePage.waitForURL(`${base}/`, { timeout: 15000 });
await settle(ownerMobilePage);
await shot(ownerMobilePage, "10-dashboard-mobile");

await browser.close();
console.log("done");
