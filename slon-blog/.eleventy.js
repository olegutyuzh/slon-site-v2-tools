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
  eleventyConfig.addFilter("markdown", function(text) {
    return md.render(text || "");
  });

  // ===== Копіювати асети як є =====
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("biography.css");
  eleventyConfig.addPassthroughCopy("blog.css");
  eleventyConfig.addPassthroughCopy("voices.css");
  eleventyConfig.addPassthroughCopy("share.css");
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
