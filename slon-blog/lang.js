// Підтримувані мови
const SUPPORTED_LANGS = ["uk", "en"];
const DEFAULT_LANG = "uk";

// Нормалізація: "ua" -> "uk", невідомі коди -> DEFAULT_LANG
function normalizeLang(lang) {
    if (lang === "ua") return "uk";
    if (SUPPORTED_LANGS.includes(lang)) return lang;
    return DEFAULT_LANG;
}

let currentLang = normalizeLang(localStorage.getItem("lang"));
let translationsCache = null;

function setLanguage(lang) {
    currentLang = normalizeLang(lang);
    localStorage.setItem("lang", currentLang);
    applyTranslations();
    updateActiveButtons();
}


const urlLang = new URLSearchParams(location.search).get("lang");
if (urlLang) {
  currentLang = normalizeLang(urlLang);
  localStorage.setItem("lang", currentLang);
} else {
  currentLang = normalizeLang(localStorage.getItem("lang"));
}

function updateActiveButtons() {
    // Підтримуємо як data-lang="ua", так і data-lang="uk"
    document.querySelectorAll("[data-lang]").forEach(btn => {
        const btnLang = normalizeLang(btn.dataset.lang);
        btn.classList.toggle("is-active", btnLang === currentLang);
    });
}

function applyTranslations() {
    const render = (data) => {
        const dict = data[currentLang] || data[DEFAULT_LANG] || {};

        // Текстовий вміст: <h1 data-i18n="key">...</h1>
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key] !== undefined) {
                el.textContent = dict[key];
            }
        });

        // HTML-вміст: <p data-i18n-html="key">...</p>
        // Використовується для перекладів, що містять HTML-теги (<em>, <strong>, <br> тощо).
        // Сюди можна вставляти тільки переклади з власного i18n.json — НЕ дані від користувачів.
        document.querySelectorAll("[data-i18n-html]").forEach(el => {
            const key = el.getAttribute("data-i18n-html");
            if (dict[key] !== undefined) {
                el.innerHTML = dict[key];
            }
        });

        // Placeholder для input/textarea: data-i18n-placeholder="key"
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (dict[key] !== undefined) {
                el.setAttribute("placeholder", dict[key]);
            }
        });

        // Title (тултипи): data-i18n-title="key"
        document.querySelectorAll("[data-i18n-title]").forEach(el => {
            const key = el.getAttribute("data-i18n-title");
            if (dict[key] !== undefined) {
                el.setAttribute("title", dict[key]);
            }
        });

        // Alt для зображень: data-i18n-alt="key"
        document.querySelectorAll("[data-i18n-alt]").forEach(el => {
            const key = el.getAttribute("data-i18n-alt");
            if (dict[key] !== undefined) {
                el.setAttribute("alt", dict[key]);
            }
        });

        // Aria-label: data-i18n-aria-label="key"
        document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
            const key = el.getAttribute("data-i18n-aria-label");
            if (dict[key] !== undefined) {
                el.setAttribute("aria-label", dict[key]);
            }
        });

        // Двомовний контент (для блогу): <span data-lang-content="uk">...</span>
        // Показуємо тільки той блок, що відповідає поточній мові.
        // Використовується там, де контент зберігається не в i18n.json,
        // а прямо в HTML двома мовами одразу (наприклад, статті блогу).
        document.querySelectorAll("[data-lang-content]").forEach(el => {
            const elLang = normalizeLang(el.getAttribute("data-lang-content"));
            if (elLang === currentLang) {
                // Прибираємо inline-стиль зовсім, щоб НЕ перемогло CSS-правило
                // [data-lang-content="en"] { display: none } у blog.css
                el.style.removeProperty("display");
                // Підказка браузеру: для надійності задаємо клас замість inline-style.
                // CSS нижче (.lang-visible) має пріоритет над загальним правилом.
                el.classList.add("lang-visible");
            } else {
                el.style.display = "none";
                el.classList.remove("lang-visible");
            }
        });

        // Оновлюємо <html lang="...">
        document.documentElement.setAttribute("lang", currentLang);
    };

    if (translationsCache) {
        render(translationsCache);
        return;
    }

    fetch("/i18n.json")
        .then(res => {
            if (!res.ok) throw new Error("Failed to load i18n.json: " + res.status);
            return res.json();
        })
        .then(data => {
            translationsCache = data;
            window.translationsCache = data; // експорт для інших скриптів (напр. contact.html)
            render(data);
        })
        .catch(err => console.error("[i18n]", err));
}

document.addEventListener("DOMContentLoaded", () => {
    applyTranslations();
    updateActiveButtons();

    // Вішаємо обробники на всі кнопки з data-lang
    document.querySelectorAll("[data-lang]").forEach(btn => {
        btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
    });
});