/* ========================================================================
   STORY SHARE — динамічне формування share-посилань для соцмереж.
   Працює без сторонніх трекерів — тільки прямі посилання на share-ендпоінти
   соцмереж + Web Share API для рідного меню на мобільних.
   ======================================================================== */

(function() {
  'use strict';

  // Чекаємо, поки DOM завантажиться
  document.addEventListener('DOMContentLoaded', initShare);

  function initShare() {
    const shareBlock = document.querySelector('.story-share');
    if (!shareBlock) return;

    // Беремо URL і заголовок поточної сторінки.
    // Заголовок беремо з <title>, але прибираємо суфікс " — Слон" / " — Slon".
    const url = window.location.origin + window.location.pathname;
    const titleRaw = document.title || '';
    const title = titleRaw.replace(/\s*[—–-]\s*(Слон|Slon)\s*$/i, '').trim();

    // Опис беремо з meta description, якщо є
    const metaDesc = document.querySelector('meta[name="description"]');
    const description = metaDesc ? metaDesc.getAttribute('content') : '';

    // Кодуємо для URL
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    const td = encodeURIComponent(title + (description ? '\n\n' + description : '') + '\n\n' + url);

    // Налаштовуємо посилання для кожної соцмережі
    const shareLinks = {
      facebook:  `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      telegram:  `https://t.me/share/url?url=${u}&text=${t}`,
      twitter:   `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      whatsapp:  `https://api.whatsapp.com/send?text=${td}`,
      viber:     `viber://forward?text=${td}`,
      linkedin:  `https://www.linkedin.com/sharing/share-offsite/?url=${u}`
    };

    // Ставимо href на всі <a class="share-btn"> з відповідним data-share
    shareBlock.querySelectorAll('a.share-btn[data-share]').forEach(link => {
      const network = link.getAttribute('data-share');
      if (shareLinks[network]) {
        link.setAttribute('href', shareLinks[network]);
      }
    });

    // Кнопка "Скопіювати посилання"
    const copyBtn = shareBlock.querySelector('[data-share="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyToClipboard(url, copyBtn));
    }

    // Native Share — показуємо кнопку тільки якщо браузер підтримує
    // Web Share API (зазвичай це мобільні телефони + сучасні браузери).
    const nativeBtn = shareBlock.querySelector('[data-share="native"]');
    if (nativeBtn && navigator.share) {
      nativeBtn.hidden = false;
      nativeBtn.addEventListener('click', async () => {
        try {
          await navigator.share({
            title: title,
            text: description,
            url: url
          });
        } catch (err) {
          // Користувач закрив діалог — це не помилка, ігноруємо
          if (err.name !== 'AbortError') {
            console.error('[share]', err);
          }
        }
      });
    }
  }

  // Копіювання в буфер обміну з fallback для старих браузерів
  function copyToClipboard(text, btn) {
    const showCopied = () => {
      const span = btn.querySelector('span');
      const originalKey = span.getAttribute('data-i18n');
      // Показуємо "Скопійовано ✓" — якщо є lang.js, він візьме переклад
      span.setAttribute('data-i18n', 'story_share_copied');
      btn.classList.add('is-copied');

      // Оновлюємо текст одразу — беремо переклад з кешу lang.js, якщо є
      const lang = localStorage.getItem('lang') || 'uk';
      const cache = window.translationsCache;
      if (cache && cache[lang] && cache[lang]['story_share_copied']) {
        span.textContent = cache[lang]['story_share_copied'];
      } else {
        span.textContent = lang === 'en' ? 'Copied ✓' : 'Скопійовано ✓';
      }

      // Через 2 секунди повертаємо назад
      setTimeout(() => {
        btn.classList.remove('is-copied');
        span.setAttribute('data-i18n', originalKey);
        if (cache && cache[lang] && cache[lang][originalKey]) {
          span.textContent = cache[lang][originalKey];
        } else {
          span.textContent = lang === 'en' ? 'Copy link' : 'Скопіювати посилання';
        }
      }, 2000);
    };

    // Сучасний API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(showCopied).catch(() => fallbackCopy(text, showCopied));
    } else {
      fallbackCopy(text, showCopied);
    }
  }

  // Fallback для старих браузерів і http://
  function fallbackCopy(text, onSuccess) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (err) {
      console.error('[share] copy failed', err);
    }
    document.body.removeChild(ta);
  }

})();
