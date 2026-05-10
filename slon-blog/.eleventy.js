const fs = require("fs");
const path = require("path");

module.exports = function(eleventyConfig) {

  // ===== Завантажуємо i18n.json для використання в шаблонах =====
  const i18nPath = path.join(__dirname, "i18n.json");
  const i18n = JSON.parse(fs.readFileSync(i18nPath, "utf-8"));

  // ===== Фільтр t('key', 'uk') — повертає переклад =====
  eleventyConfig.addFilter("t", function(key, lang) {
    const dict = i18n[lang] || i18n.uk || {};
    return dict[key] !== undefined ? dict[key] : `[${key}]`;
  });

  // ===== Колекція всіх постів =====
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getAll()
      .filter(item => item.data.layout === "layouts/post.njk")
      .sort((a, b) => b.date - a.date);
  });

  // ===== Фільтр форматування дати =====
  eleventyConfig.addFilter("dateLocalized", function(date, lang) {
    const months_uk = ["січня", "лютого", "березня", "квітня", "травня", "червня",
                       "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
    const d = new Date(date);
    if (lang === "uk") {
      return `${d.getDate()} ${months_uk[d.getMonth()]} ${d.getFullYear()}`;
    }
    return d.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
  });

  // ===== Helper: екрануємо HTML-небезпечні символи =====
  function escapeHtml(s) {
    if (s === undefined || s === null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ===== Helper: валідація Cloudflare Stream UID =====
  function isValidStreamUid(uid) {
    return typeof uid === "string" && /^[a-f0-9]{32}$/i.test(uid);
  }

  // ===== Helper: валідація BCP-47 мовного коду =====
  // Дозволяємо "uk", "en", "uk-UA", "en-US" тощо. Захист від випадкового
  // вписання довільних рядків у URL.
  function isValidLangCode(lang) {
    return typeof lang === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(lang);
  }

  // ===== Шорткод figure — двомовне фото з підписом =====
  eleventyConfig.addShortcode("figure", function(src, captionUk, captionEn, modifier) {
    const isPortrait = modifier === "portrait";
    const figClass = isPortrait ? "story-figure story-figure--portrait" : "story-figure";
    const safeSrc = escapeHtml(src);
    const safeAlt = escapeHtml(captionUk || captionEn || "");

    let captionHtml = "";
    if (captionUk || captionEn) {
      captionHtml = `
        <figcaption class="story-figure-caption">
          <span data-lang-content="uk">${escapeHtml(captionUk || "")}</span>
          <span data-lang-content="en">${escapeHtml(captionEn || "")}</span>
        </figcaption>`;
    }

    return `<figure class="${figClass}">
      <div class="story-figure-img">
        <img src="${safeSrc}" alt="${safeAlt}" loading="lazy" />
      </div>${captionHtml}
    </figure>`;
  });

  // ===== Шорткод video — Cloudflare Stream відео з двомовним підписом =====
  //
  // Базове використання:
  //   {% video "31c9291ab41fac05471db4e73aa11717", "Інтервʼю", "Interview" %}
  //
  // З модифікатором "portrait" (вертикальне):
  //   {% video "...", "Підпис", "Caption", "portrait" %}
  //
  // З опціями (5-й аргумент — обʼєкт):
  //   {% video "...", "Підпис", "Caption", null, { defaultTextTrack: "uk" } %}
  //   {% video "...", "Підпис", "Caption", "portrait", { defaultTextTrack: "uk", autoplay: false } %}
  //
  // Опції:
  //   defaultTextTrack — мовний код субтитрів, що ввімкнуться автоматично ("uk", "en", "uk-UA", ...).
  //                      ВАЖЛИВО: субтитри мають бути попередньо завантажені до відео
  //                      в Cloudflare Dashboard → Stream → відео → Captions.
  //   primaryColor     — колір контролів плеєра (hex без #), напр. "b8956a"
  //   muted            — true/false, починати без звуку (корисно з autoplay)
  //   autoplay         — true/false (за замовчуванням false; майже всі браузери блокують
  //                      autoplay зі звуком, тому використовувати разом з muted=true)
  //   loop             — true/false, зациклити відео
  //   preload          — "none" | "metadata" | "auto" (за замовчуванням "metadata")
  eleventyConfig.addShortcode("video", function(uid, captionUk, captionEn, modifier, options) {
    if (!isValidStreamUid(uid)) {
      console.warn(`[video shortcode] Invalid Cloudflare Stream UID: "${uid}"`);
      return `<!-- video shortcode: invalid UID "${escapeHtml(uid)}" -->`;
    }

    const subdomain = this.ctx?.site?.cloudflareStream?.customerSubdomain;
    if (!subdomain) {
      console.warn("[video shortcode] Missing site.cloudflareStream.customerSubdomain in _data/site.js");
      return `<!-- video shortcode: missing customerSubdomain config -->`;
    }

    const safeUid = escapeHtml(uid);
    const safeSubdomain = escapeHtml(subdomain);
    const isPortrait = modifier === "portrait";
    const figClass = isPortrait
      ? "story-figure story-figure--video story-figure--portrait"
      : "story-figure story-figure--video";

    // Постер для preview перед запуском
    const posterUrl = `https://${safeSubdomain}/${safeUid}/thumbnails/thumbnail.jpg`;

    // ===== Збираємо параметри URL для iframe плеєра =====
    // Документація: https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/
    const params = new URLSearchParams();
    params.set("poster", posterUrl);

    const opts = options || {};

    // Субтитри — найважливіше
    if (opts.defaultTextTrack) {
      if (isValidLangCode(opts.defaultTextTrack)) {
        params.set("defaultTextTrack", opts.defaultTextTrack);
      } else {
        console.warn(`[video shortcode] Invalid defaultTextTrack: "${opts.defaultTextTrack}"`);
      }
    }

    // Колір контролів (без #, тільки hex)
    if (opts.primaryColor && /^[a-f0-9]{6}$/i.test(opts.primaryColor)) {
      params.set("primaryColor", opts.primaryColor);
    }

    if (opts.muted === true) params.set("muted", "true");
    if (opts.autoplay === true) params.set("autoplay", "true");
    if (opts.loop === true) params.set("loop", "true");
    if (["none", "metadata", "auto"].includes(opts.preload)) {
      params.set("preload", opts.preload);
    }

    const iframeSrc = `https://${safeSubdomain}/${safeUid}/iframe?${params.toString()}`;
    const safeTitle = escapeHtml(captionUk || captionEn || "Відео");

    let captionHtml = "";
    if (captionUk || captionEn) {
      captionHtml = `
        <figcaption class="story-figure-caption">
          <span data-lang-content="uk">${escapeHtml(captionUk || "")}</span>
          <span data-lang-content="en">${escapeHtml(captionEn || "")}</span>
        </figcaption>`;
    }

    return `<figure class="${figClass}">
      <div class="story-figure-video-wrap">
        <iframe
          src="${iframeSrc}"
          title="${safeTitle}"
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowfullscreen></iframe>
      </div>${captionHtml}
    </figure>`;
  });

  // ===== Фільтр markdown =====
  const markdownIt = require("markdown-it");
  const markdownItAttrs = require("markdown-it-attrs");
  const md = markdownIt({ html: true, breaks: false, linkify: true })
    .use(markdownItAttrs, {
      allowedAttributes: ["class"]
    });

  eleventyConfig.addFilter("markdown", function(text) {
    if (!text) return "";

    let processed = text;
    try {
      if (this.env && this.ctx) {
        processed = this.env.renderString(text, this.ctx);
      }
    } catch (e) {
      console.warn("[markdown filter] Nunjucks render failed:", e.message);
      processed = text;
    }

    return md.render(processed);
  });

  // ===== Копіювати асети як є =====
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("biography.css");
  eleventyConfig.addPassthroughCopy("blog.css");
  eleventyConfig.addPassthroughCopy("voices.css");
  eleventyConfig.addPassthroughCopy("share.css");
  eleventyConfig.addPassthroughCopy("bottom_menu.css");
  eleventyConfig.addPassthroughCopy("share.js");
  eleventyConfig.addPassthroughCopy("i18n.json");
  eleventyConfig.addPassthroughCopy("lang.js");

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
