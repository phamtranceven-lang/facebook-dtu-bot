import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const PAGES = [
  { name: "Đại học Duy Tân", url: "https://www.facebook.com/daihocduytan.dtu" },
  { name: "Duy Tan University", url: "https://www.facebook.com/Duy.Tan.University" },
  { name: "Tuyển sinh Đại học Duy Tân", url: "https://www.facebook.com/tuyensinhDTU" },
  {
    name: "DTU - Trường Khoa học Máy tính và Trí tuệ Nhân tạo",
    url: "https://www.facebook.com/truongkhoahocmaytinh",
  },
  {
    name: "Tuổi trẻ Trường Công nghệ - Đại học Duy Tân",
    url: "https://www.facebook.com/TuoitreTruongCongNgheDhDuyTan",
  },
  {
    name: "Tuổi trẻ Trường Kinh tế - Đại học Duy Tân",
    url: "https://www.facebook.com/dtkt.dtu",
  },
  {
    name: "Trường Du lịch - Đại học Duy Tân",
    url: "https://www.facebook.com/DuyTanHTi",
  },
  {
    name: "DTU - Trường Ngôn ngữ - Xã hội Nhân văn",
    url: "https://www.facebook.com/ngoaingudaihocduytan",
  },
  {
    name: "DTU - Khoa Khoa học Xã hội và Nhân văn",
    url: "https://www.facebook.com/KhoaKhoaHocXaHoiVaNhanVanDaiHocDuyTan",
  },
  {
    name: "Trường Y Dược - Đại học Duy Tân",
    url: "https://www.facebook.com/TruongYDuocDHDT",
  },
  {
    name: "DTU - Trường Đào tạo Quốc tế",
    url: "https://www.facebook.com/DTU.InternationalSchool",
  },
  { name: "LCDKCK DTU", url: "https://www.facebook.com/LCDKCKDTU" },
];

const PIN_KEYWORDS = [
  // Công văn, văn bản hành chính
  "công văn",
  "quyết định",
  "công điện",
  "hướng dẫn thực hiện",
  "triển khai thực hiện",
  "yêu cầu thực hiện",
  "đề nghị thực hiện",
  "gia hạn",
  "hạn chót",
  "nộp hồ sơ",
  "bổ sung hồ sơ",
  "khai báo",

  // Đăng ký tín chỉ, học phần, lớp
  "đăng kí tín chỉ",
  "đăng ký tín chỉ",
  "đăng kí học phần",
  "đăng ký học phần",
  "đăng kí môn học",
  "đăng ký môn học",
  "kế hoạch đăng ký lớp",
  "kế hoạch đăng kí lớp",
  "thời gian đăng ký lớp",
  "thời gian đăng kí lớp",
  "đăng ký lớp học kỳ",
  "đăng kí lớp học kỳ",
  "lịch đăng ký học phần",
  "lịch đăng kí học phần",
  "trung tâm mở lớp",
  "mở lớp học phần",
  "mở lớp bổ sung",
  "hủy lớp",
  "đóng lớp",

  // BHYT
  "bhyt",
  "bảo hiểm y tế",
  "bảo hiểm y tế sinh viên",
  "tham gia bhyt",
  "thực hiện bhyt",
  "thẻ bhyt",
  "gia hạn bhyt",
  "mức đóng bhyt",
  "bổ sung thông tin bhyt",

  // Học phí
  "nộp học phí",
  "học phí học kỳ",
  "học phí học kỳ hè",
  "thời hạn nộp học phí",
  "đóng học phí",
  "gia hạn học phí",
  "miễn giảm học phí",

  // Thời tiết, nghỉ học, học trực tuyến
  "tổ chức học trực tuyến",
  "chuyển sang học trực tuyến",
  "tạm dừng học trực tiếp",
  "nghỉ học do bão",
  "nghỉ học do ảnh hưởng của bão",
  "nghỉ học do mưa lớn",
  "phòng chống mưa lớn",
  "mưa lớn và ngập lụt",
  "mưa lớn, ngập lụt",

  // Học vụ quan trọng
  "lịch thi",
  "đổi lịch thi",
  "hoãn thi",
  "điều chỉnh lịch học",
  "cảnh báo học vụ",
  "xét tốt nghiệp",
  "xét học bổng",

  // Rèn luyện
  "đánh giá rèn luyện",
  "điểm rèn luyện",
  "kết quả rèn luyện",
  "xếp loại rèn luyện",
  "phiếu đánh giá rèn luyện",
  "minh chứng rèn luyện",
  "rèn luyện sinh viên",

  // Theo yêu cầu
  "tin hot",
];

const STATE_FILE = path.resolve("state.json");
const DEBUG_DIR = path.resolve("debug");
const MAX_SEEN = 5000;
const POSTS_PER_PAGE = 5;
const CAPTION_MAX = 1024;
const TEXT_MAX = 4096;
const BOT_MODE = String(process.env.BOT_MODE || "normal").toLowerCase();
const ANTI_DUP_VERSION = 4;

async function main() {
  needEnv(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
  await fs.mkdir(DEBUG_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1365, height: 1600 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  await loadFacebookCookies(context);

  const allPosts = [];
  const pageErrors = [];

  try {
    for (let index = 0; index < PAGES.length; index += 1) {
      const target = PAGES[index];
      console.log(`\n[${index + 1}/${PAGES.length}] ${target.name}`);

      try {
        const posts = await scrapeFacebookPage(context, target, index);
        allPosts.push(...posts);
        console.log(`Tìm thấy ${posts.length} bài.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pageErrors.push({ page: target.name, error: message });
        console.error(`Lỗi ${target.name}:`, message);
      }

      if (index < PAGES.length - 1) await sleep(1500);
    }
  } finally {
    await browser.close();
  }

  const posts = dedupe(allPosts);
  console.log(`\nTổng số bài duy nhất: ${posts.length}`);

  if (BOT_MODE === "test3") {
    const testPosts = posts.slice(0, 3).reverse();
    let sent = 0;

    for (const post of testPosts) {
      await sendPost(post, true);
      sent += 1;
      await sleep(1000);
    }

    console.log(`Đã gửi thử ${sent} bài. Không cập nhật state.json.`);
    printSummary({ ok: sent > 0, mode: "test3", found: posts.length, sent, pageErrors });
    return;
  }

  const state = await loadState();

  // PRO MAX anti-duplicate migration.
  // Nếu state.json cũ chưa có bộ khóa chống trùng đời mới thì chỉ ghi nhận các bài đang thấy,
  // không gửi lần này. Làm vậy để chặn spam lại các bài đã từng gửi trong Telegram.
  if (!state.initialized || state.antiDuplicateVersion !== ANTI_DUP_VERSION) {
    await rememberVisiblePosts(state, posts);
    console.log(
      `Đã khởi tạo/nâng cấp state.json sang Anti-Dup v${ANTI_DUP_VERSION}. ` +
        "Lần này không gửi để tránh spam lại bài cũ."
    );
    printSummary({
      ok: posts.length > 0 || pageErrors.length < PAGES.length,
      initialized: true,
      upgradedAntiDuplicate: true,
      antiDuplicateVersion: ANTI_DUP_VERSION,
      found: posts.length,
      sent: 0,
      pageErrors,
    });
    return;
  }

  const newPosts = posts.filter((post) => !isSeenPost(state, post)).reverse();

  if (newPosts.length === 0) {
    await rememberVisiblePosts(state, posts);
    console.log("Chưa có bài mới. Đã cập nhật thêm UID/key hiện thấy để chống trùng.");
    printSummary({
      ok: posts.length > 0 || pageErrors.length < PAGES.length,
      found: posts.length,
      sent: 0,
      antiDuplicateVersion: ANTI_DUP_VERSION,
      pageErrors,
    });
    return;
  }

  let sent = 0;
  let pinned = 0;
  let skippedDuplicateBeforeSend = 0;
  const sendErrors = [];

  for (const post of newPosts) {
    try {
      // Lớp bảo vệ cuối: kiểm tra lại ngay trước khi gửi.
      // Nếu cùng run hoặc run trước đã nhớ post này thì tuyệt đối không gửi lần 2.
      if (isSeenPost(state, post)) {
        skippedDuplicateBeforeSend += 1;
        console.log("Bỏ qua trùng ngay trước khi gửi:", post.uid || post.id, post.author);
        continue;
      }

      // Mark-before-send: ghi state trước khi gửi Telegram để nếu job/rerun bị lặp,
      // bài này vẫn không bị bắn lại lần 2. Ưu tiên không spam hơn là gửi lại khi lỗi mạng.
      rememberPost(state, post);
      await saveStateObject(state);

      const result = await sendPost(post, false);
      sent += 1;
      if (result.pinned) pinned += 1;
      await sleep(1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendErrors.push({ page: post.author, url: post.url, uid: post.uid, error: message });
      console.error("Không gửi được bài:", message);
    }
  }

  printSummary({
    ok: sendErrors.length === 0,
    found: posts.length,
    newPosts: newPosts.length,
    sent,
    pinned,
    pageErrors,
    sendErrors,
  });
}

async function scrapeFacebookPage(context, target, pageIndex) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);

  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissFacebookOverlays(page);
    await page.waitForTimeout(4500);

    // Mở trước các nút "Xem thêm" của Facebook để lấy được full caption,
    // tránh gửi chữ "Xem thêm" giả sang Telegram nhưng không có nội dung để bung ra.
    await expandFacebookSeeMore(page);

    await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight, 1800)));
    await page.waitForTimeout(2200);
    await expandFacebookSeeMore(page);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(800);
    await expandFacebookSeeMore(page);

    const rawPosts = await page.evaluate(({ targetName, targetUrl, postsPerPage, pageIndex }) => {
      const articleElements = Array.from(document.querySelectorAll('div[role="article"]'));
      const seenUrls = new Set();
      const output = [];

      const badTextLines = new Set([
        "thích",
        "bình luận",
        "chia sẻ",
        "like",
        "comment",
        "share",
        "xem thêm",
        "see more",
        "all reactions",
        "tất cả cảm xúc",
        "tất cả cảm xúc:",
        "most relevant is selected, so some comments may have been filtered out.",
      ]);

      function isBadUiLine(line) {
        const text = String(line || "").trim();
        const value = text.toLowerCase();
        if (!value) return true;
        if (badTextLines.has(value)) return true;
        if (value.includes("tất cả cảm xúc")) return true;
        if (/^[·•.\-–—:]+$/.test(value)) return true;

        // Các dòng UI/metadata của Facebook hay bị lẫn vào caption khi scrape public page.
        if (/^(vừa xong|just now|hôm qua|yesterday|đã chỉnh sửa|edited)$/.test(value)) return true;
        if (/^\d+\s*(giây|phút|giờ|ngày|tuần|tháng|năm|second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)$/.test(value)) return true;
        if (/^\d+\s*(giây|phút|giờ|ngày|tuần|tháng|năm)\s*trước$/.test(value)) return true;
        if (/^\d+\s*(lượt xem|views?|bình luận|comments?|chia sẻ|shares?)$/.test(value)) return true;

        // Reaction count thường hiện thành các dòng rời như 380 / 2 / 4 / +25.
        if (/^\+?\d{1,6}([.,]\d+)?([kmb]|\s*(ngàn|nghìn|triệu))?$/.test(value)) return true;
        return false;
      }

      function normalizeText(value) {
        return String(value || "")
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => !isBadUiLine(line))
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }

      function findMessageText(article) {
        // Ưu tiên đúng container nội dung bài viết, không lấy cả article.innerText
        // vì article.innerText lẫn ngày đăng, reaction count, comment/share.
        const selectors = [
          '[data-ad-comet-preview="message"]',
          '[data-ad-preview="message"]',
          'div[data-ad-comet-preview="message"]',
          'div[data-ad-preview="message"]',
        ];

        const candidates = [];
        for (const selector of selectors) {
          for (const node of Array.from(article.querySelectorAll(selector))) {
            const text = normalizeText(node.innerText || node.textContent || "");
            if (text.length >= 8) candidates.push(text);
          }
        }

        if (candidates.length > 0) {
          return candidates.sort((a, b) => b.length - a.length)[0];
        }

        return normalizeText(article.innerText || article.textContent || "");
      }

      function canonicalize(rawHref) {
        try {
          const url = new URL(rawHref, "https://www.facebook.com");
          url.hash = "";

          if (url.searchParams.has("story_fbid")) {
            const story = url.searchParams.get("story_fbid");
            const id = url.searchParams.get("id");
            url.search = "";
            if (story) url.searchParams.set("story_fbid", story);
            if (id) url.searchParams.set("id", id);
            return url.toString();
          }

          url.search = "";
          return url.toString();
        } catch {
          return "";
        }
      }

      function findPostUrl(article) {
        const anchors = Array.from(article.querySelectorAll("a[href]"));
        const patterns = [
          "/posts/",
          "/videos/",
          "/photos/",
          "/permalink/",
          "story_fbid=",
        ];

        for (const pattern of patterns) {
          const anchor = anchors.find((item) => String(item.href || "").includes(pattern));
          if (anchor) return canonicalize(anchor.href);
        }

        return "";
      }

      function findTimestamp(article, fallbackIndex) {
        const unixNode = article.querySelector("[data-utime]");
        if (unixNode) {
          const unix = Number(unixNode.getAttribute("data-utime"));
          if (Number.isFinite(unix) && unix > 0) return unix * 1000;
        }

        const timeNode = article.querySelector("time[datetime]");
        if (timeNode) {
          const parsed = Date.parse(timeNode.getAttribute("datetime") || "");
          if (Number.isFinite(parsed)) return parsed;
        }

        return Date.now() - pageIndex * 100000 - fallbackIndex * 1000;
      }

      function findImage(article) {
        const images = Array.from(article.querySelectorAll("img[src]"))
          .map((img) => ({
            src: img.currentSrc || img.src || "",
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
            alt: String(img.alt || "").toLowerCase(),
          }))
          .filter((item) => item.src.startsWith("http"))
          .filter((item) => item.width >= 250 && item.height >= 180)
          .filter((item) => !item.alt.includes("profile picture"))
          .sort((a, b) => b.width * b.height - a.width * a.height);

        return images[0]?.src || null;
      }

      for (let index = 0; index < articleElements.length; index += 1) {
        if (output.length >= postsPerPage) break;

        const article = articleElements[index];
        const url = findPostUrl(article);
        if (!url || seenUrls.has(url)) continue;

        const text = findMessageText(article);
        if (!text || text.length < 8) continue;

        seenUrls.add(url);
        output.push({
          url,
          text,
          imageUrl: findImage(article),
          timestamp: findTimestamp(article, index),
          author: targetName,
          sourcePage: targetUrl,
        });
      }

      return output;
    }, {
      targetName: target.name,
      targetUrl: target.url,
      postsPerPage: POSTS_PER_PAGE,
      pageIndex,
    });

    const posts = rawPosts.map((post) => {
      const text = cleanFacebookText(post.text, target.name);
      const uid = makePostUid(post.url);
      const normalizedUrl = normalizePostUrl(post.url);
      const enrichedPost = {
        ...post,
        id: uid,
        uid,
        normalizedUrl,
        text,
      };

      return {
        ...enrichedPost,
        fingerprint: hashShort(normalizeForDedup(text), 32),
        keys: makePostKeys(enrichedPost),
      };
    });

    if (posts.length === 0) {
      const slug = safeFilename(target.name);
      await page.screenshot({ path: path.join(DEBUG_DIR, `${slug}.png`), fullPage: false });
      await fs.writeFile(path.join(DEBUG_DIR, `${slug}.html`), await page.content(), "utf8");
    }

    return posts;
  } finally {
    await page.close();
  }
}


async function expandFacebookSeeMore(page) {
  for (let round = 0; round < 4; round += 1) {
    const clicked = await page.evaluate(() => {
      const isReadMoreText = (value) => {
        const text = String(value || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

        return text === "xem thêm" || text === "see more";
      };

      const candidates = Array.from(
        document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], button, a, span')
      );

      let count = 0;
      const clickedNodes = new Set();

      for (const node of candidates) {
        const text = node.innerText || node.textContent || "";
        if (!isReadMoreText(text)) continue;

        const clickable =
          node.closest('div[role="button"], span[role="button"], a[role="button"], button, a') || node;

        if (clickedNodes.has(clickable)) continue;
        clickedNodes.add(clickable);

        try {
          clickable.click();
          count += 1;
        } catch {
          // Bỏ qua nếu Facebook chặn click trên node này.
        }
      }

      return count;
    });

    if (!clicked) break;
    await page.waitForTimeout(700);
  }
}

async function dismissFacebookOverlays(page) {
  const labels = [
    "Allow all cookies",
    "Cho phép tất cả cookie",
    "Only allow essential cookies",
    "Chỉ cho phép cookie thiết yếu",
    "Decline optional cookies",
    "Từ chối cookie không bắt buộc",
    "Close",
    "Đóng",
  ];

  for (const label of labels) {
    try {
      const button = page.getByRole("button", { name: label, exact: true }).first();
      if (await button.isVisible({ timeout: 600 })) {
        await button.click({ timeout: 1500 });
        await page.waitForTimeout(400);
      }
    } catch {
      // Facebook thay đổi giao diện thường xuyên; bỏ qua nếu nút không tồn tại.
    }
  }
}

async function loadFacebookCookies(context) {
  const raw = process.env.FACEBOOK_COOKIES_JSON;
  if (!raw) {
    console.log("Không có FACEBOOK_COOKIES_JSON; thử quét page công khai không đăng nhập.");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;

    if (!Array.isArray(cookies) || cookies.length === 0) {
      throw new Error("Secret không chứa danh sách cookies hợp lệ.");
    }

    const normalized = cookies
      .filter((cookie) => cookie && cookie.name && cookie.value)
      .map((cookie) => ({
        name: String(cookie.name),
        value: String(cookie.value),
        domain: cookie.domain || ".facebook.com",
        path: cookie.path || "/",
        expires: Number.isFinite(Number(cookie.expires)) ? Number(cookie.expires) : -1,
        httpOnly: Boolean(cookie.httpOnly),
        secure: cookie.secure !== false,
        sameSite: normalizeSameSite(cookie.sameSite),
      }));

    await context.addCookies(normalized);
    console.log(`Đã nạp ${normalized.length} Facebook cookies từ GitHub Secret.`);
  } catch (error) {
    throw new Error(
      "FACEBOOK_COOKIES_JSON không hợp lệ: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
}

function normalizeSameSite(value) {
  const text = String(value || "").toLowerCase();
  if (text === "strict") return "Strict";
  if (text === "none" || text === "no_restriction") return "None";
  return "Lax";
}

function isBadFacebookUiLine(line) {
  const text = String(line || "").trim();
  const value = normalizeForSearch(text);
  if (!value) return true;

  const exactBad = new Set([
    "thich",
    "binh luan",
    "chia se",
    "like",
    "comment",
    "share",
    "xem them",
    "see more",
    "all reactions",
    "tat ca cam xuc",
    "tat ca cam xuc:",
  ]);

  if (exactBad.has(value)) return true;
  if (value.includes("tat ca cam xuc")) return true;
  if (/^[·•.\-–—:]+$/.test(text)) return true;
  if (/^(vua xong|just now|hom qua|yesterday|da chinh sua|edited)$/.test(value)) return true;
  if (/^\d+\s*(giay|phut|gio|ngay|tuan|thang|nam|second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)$/.test(value)) return true;
  if (/^\d+\s*(giay|phut|gio|ngay|tuan|thang|nam)\s*truoc$/.test(value)) return true;
  if (/^\d+\s*(luot xem|views?|binh luan|comments?|chia se|shares?)$/.test(value)) return true;
  if (/^\+?\d{1,6}([.,]\d+)?([kmb]|\s*(ngan|nghin|trieu))?$/.test(value)) return true;

  return false;
}


function stripFacebookReadMoreMarker(value) {
  return String(value || "")
    .replace(/(?:\s|^)(?:…|\.\.\.)?\s*(xem thêm|see more)\s*$/gi, "")
    .replace(/(?:\s|^)(xem thêm|see more)\s*$/gi, "")
    .trim();
}

function cleanFacebookText(value, author) {
  const authorSearch = normalizeForSearch(author);

  const lines = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => normalizeForSearch(line) !== authorSearch)
    .filter((line) => !isBadFacebookUiLine(line));

  const text = stripFacebookReadMoreMarker(
    lines
      .map((line) => stripFacebookReadMoreMarker(line))
      .filter(Boolean)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );

  return text || "Bài viết không có nội dung chữ.";
}

function dedupe(posts) {
  const kept = [];
  const seenKeys = new Set();

  for (const post of posts) {
    if (!post?.url || !Array.isArray(post.keys) || post.keys.length === 0) continue;

    const duplicated = post.keys.some((key) => seenKeys.has(key));
    if (duplicated) continue;

    kept.push(post);
    for (const key of post.keys) seenKeys.add(key);
  }

  return kept.sort((a, b) => b.timestamp - a.timestamp);
}

function makePostUid(url) {
  const ids = extractFacebookIds(url);
  if (ids.length > 0) return ids[0];
  return hashShort(normalizePostUrl(url), 24);
}

function makePostId(url) {
  return makePostUid(url);
}

function extractFacebookIds(url) {
  const value = String(url || "");
  const ids = [];

  const add = (item) => {
    const text = String(item || "").trim();
    if (/^\d{6,}$/.test(text) && !ids.includes(text)) ids.push(text);
  };

  try {
    const parsed = new URL(value, "https://www.facebook.com");
    for (const name of [
      "story_fbid",
      "fbid",
      "id",
      "set",
      "v",
      "multi_permalinks",
    ]) {
      const param = parsed.searchParams.get(name);
      if (!param) continue;
      const matches = String(param).match(/\d{6,}/g) || [];
      for (const match of matches) add(match);
    }
  } catch {
    // Bỏ qua URL lỗi, dùng regex bên dưới.
  }

  const patterns = [
    /\/posts\/(\d{6,})/gi,
    /\/videos\/(\d{6,})/gi,
    /\/photos\/[^/]+\/(\d{6,})/gi,
    /\/permalink\/(\d{6,})/gi,
    /story_fbid=(\d{6,})/gi,
    /fbid=(\d{6,})/gi,
    /[?&]id=(\d{6,})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(value)) !== null) add(match[1]);
  }

  return ids;
}

function normalizePostUrl(url) {
  try {
    const parsed = new URL(String(url || ""), "https://www.facebook.com");
    parsed.hash = "";

    const ids = extractFacebookIds(parsed.toString());
    if (ids.length > 0) {
      return `https://www.facebook.com/post/${ids.join("-")}`;
    }

    const allowedParams = new Set(["story_fbid", "fbid", "id", "v"]);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (!allowedParams.has(key)) parsed.searchParams.delete(key);
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(url || "").trim();
  }
}

function makePostKeys(post) {
  const keys = new Set();
  const author = normalizeForSearch(post?.author || "");
  const textStrong = normalizeForDedup(post?.text || "");
  const textLoose = normalizeForLooseDedup(post?.text || "");
  const normalizedUrl = normalizePostUrl(post?.url || post?.normalizedUrl || "");
  const ids = extractFacebookIds(post?.url || "");

  for (const id of ids) {
    keys.add(`uid:${id}`);
    if (author) keys.add(`author-uid:${author}:${id}`);
  }

  if (post?.uid) keys.add(`uid:${String(post.uid)}`);
  if (normalizedUrl) keys.add(`url:${hashShort(normalizedUrl, 32)}`);

  // Lớp nội dung mạnh: cùng page + text gần nguyên bản.
  if (author && textStrong.length >= 24) {
    keys.add(`author-text:${author}:${hashShort(textStrong, 32)}`);
  }

  // Lớp nội dung mềm: bỏ hashtag/khoảng trắng/dấu câu phụ, chống Facebook đổi URL/ảnh.
  if (author && textLoose.length >= 32) {
    keys.add(`author-loose:${author}:${hashShort(textLoose, 32)}`);
  }

  // Lớp dòng đầu: nhiều bài thông báo có poster giống nhau nhưng dòng đầu là UID nội dung rất mạnh.
  const firstLine = normalizeForLooseDedup(firstNonEmptyLine(post?.text || ""));
  if (author && firstLine.length >= 16) {
    keys.add(`author-firstline:${author}:${hashShort(firstLine, 32)}`);
  }

  // Lớp ảnh: chỉ phụ trợ, không dùng một mình nếu không có author.
  const imageKey = normalizeImageUrl(post?.imageUrl || "");
  if (author && imageKey) {
    keys.add(`author-image:${author}:${hashShort(imageKey, 32)}`);
  }

  return Array.from(keys);
}

function normalizeForDedup(value) {
  return normalizeForSearch(value)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForLooseDedup(value) {
  return normalizeForDedup(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(ngay|thang|nam|hoc|ky|dai|hoc|duy|tan)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNonEmptyLine(value) {
  return (
    String(value || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
}

function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    parsed.hash = "";

    // Facebook CDN query đổi liên tục; giữ path là đủ để chống trùng theo ảnh.
    parsed.search = "";
    return parsed.hostname + parsed.pathname;
  } catch {
    return url.replace(/\?.*$/, "");
  }
}

function hashShort(value, length = 24) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function isSeenPost(state, post) {
  const keys = Array.isArray(post?.keys) ? post.keys : makePostKeys(post);
  return keys.some((key) => state.seenKeys.has(key));
}

function rememberPost(state, post) {
  const keys = Array.isArray(post?.keys) ? post.keys : makePostKeys(post);
  const uid = post?.uid || post?.id || makePostUid(post?.url || "");

  if (uid) state.ids.push(String(uid));
  if (post?.url) state.urls.push(normalizePostUrl(post.url));
  if (post?.fingerprint) state.fingerprints.push(String(post.fingerprint));

  for (const key of keys) {
    state.keys.push(key);
    state.seenKeys.add(key);
  }

  state.records.push({
    uid: String(uid || ""),
    author: post?.author || "",
    url: post?.url || "",
    textHash: hashShort(normalizeForDedup(post?.text || ""), 24),
    keys: keys.slice(0, 20),
    seenAt: new Date().toISOString(),
  });

  trimState(state);
}

async function rememberVisiblePosts(state, posts) {
  for (const post of posts) rememberPost(state, post);
  state.initialized = true;
  state.antiDuplicateVersion = ANTI_DUP_VERSION;
  await saveStateObject(state);
}

async function sendPost(post, testMode) {
  const matchedPinKeywords = getMatchedPinKeywords(post);
  const priority = matchedPinKeywords.length > 0;

  const titleBase = testMode
    ? "🧪 TEST — " + post.author
    : "🔔 " + post.author + " vừa có bài mới";

  const title =
    titleBase +
    (priority
      ? "\n📌 Bài quan trọng — từ khóa: " + matchedPinKeywords.join(", ")
      : "");

  const time = new Date(post.timestamp).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });

  const linkedTimeText = "🕒 " + time;
  const linkedTime =
    '<a href="' + escapeHtml(post.url) + '">' + escapeHtml(linkedTimeText) + "</a>";

  const mainChatId = process.env.TELEGRAM_CHAT_ID;
  const priorityChatId = String(process.env.TELEGRAM_PRIORITY_CHAT_ID || "").trim();

  const messageId = await sendPostToChat({
    chatId: mainChatId,
    post,
    title,
    linkedTime,
    linkedTimeText,
  });

  let pinned = false;
  let pinError = null;

  if (priority && messageId) {
    try {
      await pinMessage(mainChatId, messageId);
      pinned = true;
    } catch (error) {
      pinError = error instanceof Error ? error.message : String(error);
      console.error("Không ghim được bài ở kênh chính:", pinError);
    }
  }

  let prioritySent = false;
  let priorityPinned = false;
  let priorityError = null;

  // Nếu có bài quan trọng, gửi thêm qua chat cá nhân/nhóm riêng.
  // Lưu ý: Telegram Bot API không gửi private message bằng @username thường được;
  // phải dùng chat_id dạng số, ví dụ lấy qua getUpdates sau khi user /start bot.
  if (priority && priorityChatId) {
    try {
      const priorityMessageId = await sendPostToChat({
        chatId: priorityChatId,
        post,
        title,
        linkedTime,
        linkedTimeText,
      });
      prioritySent = Boolean(priorityMessageId);

      if (priorityMessageId) {
        await pinMessage(priorityChatId, priorityMessageId);
        priorityPinned = true;
      }
    } catch (error) {
      priorityError = error instanceof Error ? error.message : String(error);
      console.error("Không gửi/ghim được bài quan trọng sang chat riêng:", priorityError);
    }
  }

  return {
    messageId,
    priority,
    matchedPinKeywords,
    pinned,
    pinError,
    prioritySent,
    priorityPinned,
    priorityError,
  };
}

async function sendPostToChat({ chatId, post, title, linkedTime, linkedTimeText }) {
  if (post.imageUrl) {
    const caption = buildPostMessage(post, title, linkedTime, linkedTimeText, CAPTION_MAX);
    try {
      return await sendPhoto(chatId, post.imageUrl, caption);
    } catch (error) {
      console.warn("Không gửi được ảnh, chuyển sang text:", error instanceof Error ? error.message : error);
      const text = buildPostMessage(post, title, linkedTime, linkedTimeText, TEXT_MAX);
      return await sendText(chatId, text, false);
    }
  }

  const text = buildPostMessage(post, title, linkedTime, linkedTimeText, TEXT_MAX);
  return await sendText(chatId, text, false);
}

function buildPostMessage(post, title, linkedTime, linkedTimeText, maxLength) {
  const fullText = normalizePostText(
    String(post.text || "").trim() || "Bài viết không có nội dung chữ."
  );

  // Dòng thời gian luôn nằm cuối và chính là link mở bài Facebook.
  const footerHtml = linkedTime;
  const footerVisibleLength = visibleLength(linkedTimeText);

  const fixedLength =
    visibleLength(title) +
    2 + // sau tiêu đề bot
    2 + // trước footer
    footerVisibleLength;

  const contentBudget = Math.max(1, maxLength - fixedLength);

  // Chỉ hiển thị đúng câu đầu tiên.
  // Toàn bộ phần còn lại nằm trong blockquote expandable của Telegram.
  const firstSentenceParts = splitFirstSentence(fullText);
  let firstSentence = firstSentenceParts.head;
  let hiddenContent = firstSentenceParts.tail;

  const needsHidden =
    Boolean(hiddenContent) || visibleLength(firstSentence) > contentBudget;
  const hiddenReserve = needsHidden ? 3 : 0;
  const firstSentenceBudget = Math.max(1, contentBudget - hiddenReserve);

  // Nếu câu đầu quá dài, cắt mềm và chuyển phần dư xuống "Xem thêm".
  if (visibleLength(firstSentence) > firstSentenceBudget) {
    const firstSentenceSplit = splitAtBoundary(
      firstSentence,
      firstSentenceBudget
    );

    firstSentence = firstSentenceSplit.head;

    if (firstSentenceSplit.tail) {
      hiddenContent = hiddenContent
        ? firstSentenceSplit.tail + "\n\n" + hiddenContent
        : firstSentenceSplit.tail;
    }
  }

  let bodyHtml = escapeHtml(firstSentence);

  if (hiddenContent) {
    const separatorLength = 2;
    const hiddenBudget = Math.max(
      0,
      contentBudget - visibleLength(firstSentence) - separatorLength
    );

    if (hiddenBudget > 0) {
      let hiddenText = hiddenContent;

      if (visibleLength(hiddenText) > hiddenBudget) {
        const textBudget = Math.max(0, hiddenBudget - 1);
        const hiddenParts = splitAtBoundary(hiddenText, textBudget);
        hiddenText = hiddenParts.head + "…";
      }

      bodyHtml +=
        "\n\n<blockquote expandable>" +
        escapeHtml(hiddenText) +
        "</blockquote>";
    }
  }

  return escapeHtml(title) + "\n\n" + bodyHtml + "\n\n" + footerHtml;
}

function splitFirstSentence(value) {
  const text = String(value || "").trim();

  if (!text) {
    return { head: "", tail: "" };
  }

  // Chỉ lấy đúng dòng đầu tiên của bài Facebook để hiện ra ngoài.
  // Tất cả nội dung từ dòng thứ hai trở đi nằm trong "Xem thêm".
  const firstLineBreak = text.indexOf("\n");

  if (firstLineBreak >= 0) {
    return {
      head: text.slice(0, firstLineBreak).trim(),
      tail: text.slice(firstLineBreak + 1).trim(),
    };
  }

  // Nếu bài chỉ có một dòng dài thì mới cắt theo câu đầu tiên.
  const sentenceEndPattern = /[.!?…]+(?=\s|$)/gu;
  const sentenceMatch = sentenceEndPattern.exec(text);

  if (!sentenceMatch) {
    return { head: text, tail: "" };
  }

  const cut = sentenceMatch.index + sentenceMatch[0].length;

  return {
    head: text.slice(0, cut).trim(),
    tail: text.slice(cut).trim(),
  };
}

function normalizePostText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitAtBoundary(value, maxLength) {
  const text = String(value || "").trim();
  if (visibleLength(text) <= maxLength) {
    return { head: text, tail: "" };
  }

  let cut = Math.min(maxLength, text.length);
  const minimumCut = Math.floor(cut * 0.55);

  const candidates = [
    text.lastIndexOf("\n\n", cut),
    text.lastIndexOf("\n", cut),
    text.lastIndexOf(". ", cut),
    text.lastIndexOf("! ", cut),
    text.lastIndexOf("? ", cut),
    text.lastIndexOf(", ", cut),
    text.lastIndexOf(" ", cut),
  ].filter((index) => index >= minimumCut);

  if (candidates.length > 0) {
    cut = Math.max(...candidates);
    if (/^[.!?,] /.test(text.slice(cut, cut + 2))) cut += 1;
  }

  return {
    head: text.slice(0, cut).trim(),
    tail: text.slice(cut).trim(),
  };
}

function visibleLength(value) {
  return Array.from(String(value || "")).length;
}

function getMatchedPinKeywords(post) {
  const text = normalizeForSearch(post?.text || "");
  return PIN_KEYWORDS.filter((keyword) => text.includes(normalizeForSearch(keyword)));
}

function normalizeForSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

async function sendPhoto(chatId, photoUrl, caption) {
  const endpoint = telegramEndpoint("sendPhoto");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
    }),
  });

  const result = await readJson(response);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.description || `Telegram sendPhoto HTTP ${response.status}`);
  }

  return result.result?.message_id || null;
}

async function sendText(chatId, text, disablePreview) {
  const response = await fetch(telegramEndpoint("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: Boolean(disablePreview),
    }),
  });

  const result = await readJson(response);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.description || `Telegram sendMessage HTTP ${response.status}`);
  }

  return result.result?.message_id || null;
}

async function pinMessage(chatId, messageId) {
  const response = await fetch(telegramEndpoint("pinChatMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      disable_notification: true,
    }),
  });

  const result = await readJson(response);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.description || `Telegram pinChatMessage HTTP ${response.status}`);
  }
}

function telegramEndpoint(method) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const value = JSON.parse(raw);

    const ids = Array.isArray(value?.ids) ? value.ids.map(String) : [];
    const urls = Array.isArray(value?.urls) ? value.urls.map(String) : [];
    const keys = Array.isArray(value?.keys) ? value.keys.map(String) : [];
    const fingerprints = Array.isArray(value?.fingerprints)
      ? value.fingerprints.map(String)
      : [];
    const records = Array.isArray(value?.records) ? value.records : [];

    const legacyKeys = [];
    for (const id of ids) legacyKeys.push(`uid:${id}`);
    for (const url of urls) legacyKeys.push(`url:${hashShort(normalizePostUrl(url), 32)}`);
    for (const fingerprint of fingerprints) legacyKeys.push(`legacy-fp:${fingerprint}`);

    const state = {
      initialized: value?.initialized === true,
      antiDuplicateVersion: Number(value?.antiDuplicateVersion || 0),
      ids,
      urls,
      keys: keys.concat(legacyKeys),
      fingerprints,
      records,
      seenKeys: new Set(keys.concat(legacyKeys)),
    };

    trimState(state);
    return state;
  } catch {
    return {
      initialized: false,
      antiDuplicateVersion: 0,
      ids: [],
      urls: [],
      keys: [],
      fingerprints: [],
      records: [],
      seenKeys: new Set(),
    };
  }
}

async function saveState(ids, initialized) {
  const state = await loadState();
  state.initialized = initialized !== false;
  for (const id of ids || []) {
    if (!id) continue;
    state.ids.push(String(id));
    state.keys.push(`uid:${String(id)}`);
  }
  state.antiDuplicateVersion = ANTI_DUP_VERSION;
  trimState(state);
  await saveStateObject(state);
}

async function saveStateObject(state) {
  trimState(state);

  const value = {
    initialized: state.initialized !== false,
    antiDuplicateVersion: ANTI_DUP_VERSION,
    ids: uniqueLast(state.ids, MAX_SEEN),
    urls: uniqueLast(state.urls, MAX_SEEN),
    keys: uniqueLast(state.keys, MAX_SEEN * 8),
    fingerprints: uniqueLast(state.fingerprints, MAX_SEEN),
    records: state.records.slice(-MAX_SEEN),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(STATE_FILE, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function trimState(state) {
  state.ids = uniqueLast(state.ids || [], MAX_SEEN);
  state.urls = uniqueLast(state.urls || [], MAX_SEEN);
  state.keys = uniqueLast(state.keys || [], MAX_SEEN * 8);
  state.fingerprints = uniqueLast(state.fingerprints || [], MAX_SEEN);
  state.records = Array.isArray(state.records) ? state.records.slice(-MAX_SEEN) : [];
  state.seenKeys = new Set(state.keys);
}

function uniqueLast(values, limit) {
  const output = [];
  const seen = new Set();

  for (const value of Array.from(values || []).reverse()) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
    if (output.length >= limit) break;
  }

  return output.reverse();
}

function printSummary(value) {
  console.log("\n===== SUMMARY =====");
  console.log(JSON.stringify(value, null, 2));
}

function safeFilename(value) {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "facebook-page";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function needEnv(names) {
  for (const name of names) {
    if (!process.env[name]) throw new Error(`Thiếu GitHub Secret ${name}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("BOT FAILED:", error);
  process.exitCode = 1;
});
