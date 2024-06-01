const _cache = {};

export function applyInlineOneboxes(inline, ajax, opts) {
  opts = opts || {};

  const urls = Object.keys(inline).filter((url) => !_cache[url]);

  urls.forEach((url) => {
    // cache a blank locally, so we never trigger a lookup
    _cache[url] = {};
  });

  if (urls.length === 0) {
    return;
  }

  ajax("/inline-onebox", {
    data: {
      urls,
      category_id: opts.categoryId,
      topic_id: opts.topicId,
    },
  }).then((result) => {
    result["inline-oneboxes"].forEach((onebox) => {
      if (onebox.title) {
        _cache[onebox.url] = onebox;

        let links = inline[onebox.url] || [];
        links.forEach((link) => {
          link.innerText = onebox.title;
          link.classList.add("inline-onebox");
          link.classList.remove("inline-onebox-loading");
        });
      }
    });
  });
}

export function cachedInlineOnebox(url) {
  return _cache[url];
}

export function applyCachedInlineOnebox(url, onebox) {
  return (_cache[url] = onebox);
}

export function deleteCachedInlineOnebox(url) {
  return delete _cache[url];
}
