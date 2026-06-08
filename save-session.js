import { chromium } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
console.log("Đăng nhập Facebook trong cửa sổ vừa mở.");
console.log("Khi đã đăng nhập xong và thấy bảng tin, quay lại terminal rồi nhấn Enter.");

const rl = readline.createInterface({ input, output });
await rl.question("");
await rl.close();

await context.storageState({ path: "facebook-storage.json" });
await browser.close();

console.log("Đã tạo facebook-storage.json.");
console.log("Không được commit file này lên GitHub. Hãy dùng nội dung file làm Secret FACEBOOK_COOKIES_JSON.");
