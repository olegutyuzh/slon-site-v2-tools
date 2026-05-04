module.exports = {
  layout: "layouts/post.njk",
  tags: "post",
  // permalink як функція — ми отримуємо доступ до frontmatter поста через data
  eleventyComputed: {
    permalink: data => `/stories/${data.slug}.html`
  }
};
