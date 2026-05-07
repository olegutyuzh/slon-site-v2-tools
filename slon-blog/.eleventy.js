const fs = require("fs");
const path = require("path");

module.exports = function(eleventyConfig) {

  // ===== Завантажуємо i18n.json для використання в шаблонах =====
  const i18nPath = path.join(__dirname, "i18n.json");
  const i18n = JSON.parse(fs.readFileSync(i18nPath, "utf-8"));

  // ===== Фільтр t('key', 'uk') — повертає переклад =====
  // У шаблонах: {{ 'menu_about' | t('uk') }}
  // Якщо ключ відсутній — повертає [ключ] у дужках, щоб одразу побачити що чогось бракує
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

  // ===== Helper: екрануємо HTML-небезпечні символи в підписах/alt =====
  // Підписи приходять із frontmatter і тіла поста — треба захистити від випадкового
  // або зловмисного HTML, що зламає верстку чи дозволить XSS.
  function escapeHtml(s) {
    if (s === undefined || s === null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ===== Шорткод figure — двомовне фото з підписом для тіла поста =====
  // Використання у Markdown-полях body_uk / body_en:
  //   {% figure "/img/stories/photo.jpg", "Підпис українською", "English caption" %}
  //   {% figure "/img/stories/photo.jpg", "Підпис", "Caption", "portrait" %}
  //   {% figure "/img/stories/photo.jpg" %}                  // без підпису
  //
  // Параметри:
  //   src        — шлях до зображення (обовʼязковий)
  //   captionUk  — підпис українською (опційний)
  //   captionEn  — підпис англійською (опційний)
  //   modifier   — "portrait" для вертикальних фото (опційний)
  eleventyConfig.addShortcode("figure", function(src, captionUk, captionEn, modifier) {
    const isPortrait = modifier === "portrait";
    const figClass = isPortrait ? "story-figure story-figure--portrait" : "story-figure";
    const safeSrc = escapeHtml(src);
    // alt беремо з UA-підпису, або з EN, або порожній — для доступності
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

  // ===== Фільтр markdown — рендерить рядок Markdown у HTML =====
  // Потрібен щоб поля body_uk / body_en (написані в Markdown) перетворилися на HTML.
  // markdown-it-attrs додає підтримку синтаксису {:.class} для застосування CSS-класів
  // до абзаців, цитат, заголовків — це дає змогу стилізувати окремі думки/нотатки.
  const markdownIt = require("markdown-it");
  const markdownItAttrs = require("markdown-it-attrs");
  const md = markdownIt({ html: true, breaks: false, linkify: true })
    .use(markdownItAttrs, {
      // Дозволяємо тільки CSS-класи (.class) — без id, без довільних атрибутів,
      // щоб уникнути ризиків з вмістом, що приходить як текст
      allowedAttributes: ["class"]
    });

  // Фільтр markdown — двопрохідна обробка:
  //   1) Спочатку рендеримо Nunjucks (щоб {% figure %} та інші шорткоди спрацювали)
  //   2) Потім рендеримо Markdown
  // Аргумент `ctx` потрібен, бо без нього шорткод не отримає контекст сторінки.
  eleventyConfig.addFilter("markdown", function(text) {
    if (!text) return "";

    // Перший прохід: Nunjucks обробляє {% figure %}, {{ }} тощо
    // this.ctx — контекст поточної сторінки (page, eleventy, тощо)
    // this.env — Nunjucks-середовище з усіма зареєстрованими шорткодами/фільтрами
    let processed = text;
    try {
      if (this.env && this.ctx) {
        processed = this.env.renderString(text, this.ctx);
      }
    } catch (e) {
      console.warn("[markdown filter] Nunjucks render failed:", e.message);
      processed = text;
    }

    // Другий прохід: Markdown → HTML
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
