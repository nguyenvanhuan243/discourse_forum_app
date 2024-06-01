import { click, render } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import { module, skip, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import {
  query,
  queryAll,
  visible,
} from "discourse/tests/helpers/qunit-helpers";

const youtubeCooked =
  "<p>written text</p>" +
  '<div class="youtube-onebox lazy-video-container" data-video-id="ytId1" data-video-title="Cats are great" data-provider-name="youtube"> <a href="https://www.youtube.com/watch?v=ytId1"></a>Vid 1</div>' +
  "<p>more written text</p>" +
  '<div class="youtube-onebox lazy-video-container" data-video-id="ytId2" data-video-title="Kittens are great" data-provider-name="youtube"> <a href="https://www.youtube.com/watch?v=ytId2"></a>Vid 2</div>' +
  "<p>and even more</p>";

const animatedImageCooked =
  "<p>written text</p>" +
  '<p><img src="/images/avatar.png" class="animated onebox"></img></p>' +
  "<p>more written text</p>" +
  '<p><img src="/images/d-logo-sketch-small.png" class="animated onebox"></img></p>' +
  "<p>and even more</p>";

const externalImageCooked =
  "<p>written text</p>" +
  '<p><a href="http://cat1.com" class="onebox"><img src=""></img></a></p>' +
  "<p>more written text</p>" +
  '<p><a href="http://cat2.com" class="onebox"><img src=""></img></a></p>' +
  "<p>and even more</p>";

const imageCooked =
  "<p>written text</p>" +
  '<p><img src="/images/avatar.png" alt="shows alt"></p>' +
  "<p>more written text</p>" +
  '<p><img src="/images/d-logo-sketch-small.png" alt=""></p>' +
  "<p>and even more</p>" +
  '<p><img src="/images/d-logo-sketch.png" class="emoji"></p>';

const galleryCooked =
  "<p>written text</p>" +
  '<div class="onebox imgur-album">' +
  '<a href="https://imgur.com/gallery/yyVx5lJ">' +
  '<span class="outer-box"><span><span class="album-title">Le tomtom album</span></span></span>' +
  '<img src="/images/avatar.png" title="Solution" height="315" width="600">' +
  "</a>" +
  "</div>" +
  "<p>more written text</p>";

const evilString = "<script>someeviltitle</script>";
const evilStringEscaped = "&lt;script&gt;someeviltitle&lt;/script&gt;";

module("Discourse Chat | Component | chat message collapser", function (hooks) {
  setupRenderingTest(hooks);

  test("escapes uploads header", async function (assert) {
    this.set("uploads", [{ original_filename: evilString }]);
    await render(hbs`<ChatMessageCollapser @uploads={{this.uploads}} />`);

    assert.true(
      query(".chat-message-collapser-link-small").innerHTML.includes(
        evilStringEscaped
      )
    );
  });
});

module(
  "Discourse Chat | Component | chat message collapser youtube",
  function (hooks) {
    setupRenderingTest(hooks);

    test("escapes youtube header", async function (assert) {
      this.set(
        "cooked",
        youtubeCooked.replace(
          "https://www.youtube.com/watch?v=ytId1",
          `https://www.youtube.com/watch?v=${evilString}`
        )
      );
      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      assert.true(
        query(".chat-message-collapser-link").href.includes(
          "%3Cscript%3Esomeeviltitle%3C/script%3E"
        )
      );
    });

    test("shows youtube link in header", async function (assert) {
      this.set("cooked", youtubeCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const link = queryAll(".chat-message-collapser-link");

      assert.strictEqual(link.length, 2, "two youtube links rendered");
      assert.strictEqual(link[0].href, "https://www.youtube.com/watch?v=ytId1");
      assert.strictEqual(link[1].href, "https://www.youtube.com/watch?v=ytId2");
    });

    test("shows all user written text", async function (assert) {
      youtubeCooked.youtubeid;
      this.set("cooked", youtubeCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const text = queryAll(".chat-message-collapser p");

      assert.strictEqual(text.length, 3, "shows all written text");
      assert.strictEqual(
        text[0].innerText,
        "written text",
        "first line of written text"
      );
      assert.strictEqual(
        text[1].innerText,
        "more written text",
        "third line of written text"
      );
      assert.strictEqual(
        text[2].innerText,
        "and even more",
        "fifth line of written text"
      );
    });

    test("collapses and expands cooked youtube", async function (assert) {
      this.set("cooked", youtubeCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const youtubeDivs = queryAll(".youtube-onebox");

      assert.strictEqual(
        youtubeDivs.length,
        2,
        "two youtube previews rendered"
      );

      await click(
        queryAll(".chat-message-collapser-opened")[0],
        "close first preview"
      );

      assert.false(
        visible(".youtube-onebox[data-video-id='ytId1']"),
        "first youtube preview hidden"
      );
      assert.true(
        visible(".youtube-onebox[data-video-id='ytId2']"),
        "second youtube preview still visible"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(
        youtubeDivs.length,
        2,
        "two youtube previews rendered"
      );

      await click(
        queryAll(".chat-message-collapser-opened")[1],
        "close second preview"
      );

      assert.true(
        visible(".youtube-onebox[data-video-id='ytId1']"),
        "first youtube preview still visible"
      );
      assert.false(
        visible(".youtube-onebox[data-video-id='ytId2']"),
        "second youtube preview hidden"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(
        youtubeDivs.length,
        2,
        "two youtube previews rendered"
      );
    });
  }
);

module(
  "Discourse Chat | Component | chat message collapser images",
  function (hooks) {
    setupRenderingTest(hooks);
    const imageTextCooked = "<p>A picture of Tomtom</p>";

    test("shows filename for one image", async function (assert) {
      this.set("cooked", imageTextCooked);
      this.set("uploads", [{ original_filename: "tomtom.jpeg" }]);

      await render(
        hbs`<ChatMessageCollapser @cooked={{this.cooked}} @uploads={{this.uploads}} />`
      );

      assert.true(
        query(".chat-message-collapser-link-small").innerText.includes(
          "tomtom.jpeg"
        )
      );
    });

    test("shows number of files for multiple images", async function (assert) {
      this.set("cooked", imageTextCooked);
      this.set("uploads", [{}, {}]);

      await render(
        hbs`<ChatMessageCollapser @cooked={{this.cooked}} @uploads={{this.uploads}} />`
      );

      assert.true(
        query(".chat-message-collapser-link-small").innerText.includes(
          "2 files"
        )
      );
    });

    test("collapses and expands images", async function (assert) {
      this.set("cooked", imageTextCooked);
      this.set("uploads", [{ original_filename: "tomtom.png" }]);

      await render(
        hbs`<ChatMessageCollapser @cooked={{this.cooked}} @uploads={{this.uploads}} />`
      );

      const uploads = ".chat-uploads";
      const chatImageUpload = ".chat-img-upload";

      assert.true(visible(uploads));
      assert.true(visible(chatImageUpload));

      await click(".chat-message-collapser-opened");
      assert.false(visible(uploads));
      assert.false(visible(chatImageUpload));

      await click(".chat-message-collapser-closed");
      assert.true(visible(uploads));
      assert.true(visible(chatImageUpload));
    });
  }
);

module(
  "Discourse Chat | Component | chat message collapser animated image",
  function (hooks) {
    setupRenderingTest(hooks);

    test("shows links for animated image", async function (assert) {
      this.set("cooked", animatedImageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const links = queryAll("a.chat-message-collapser-link-small");

      assert.true(links[0].innerText.trim().includes("avatar.png"));
      assert.true(links[0].href.includes("avatar.png"));

      assert.true(
        links[1].innerText.trim().includes("d-logo-sketch-small.png")
      );
      assert.true(links[1].href.includes("d-logo-sketch-small.png"));
    });

    test("shows all user written text", async function (assert) {
      this.set("cooked", animatedImageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const text = queryAll(".chat-message-collapser p");

      assert.strictEqual(text.length, 5, "shows all written text");
      assert.strictEqual(text[0].innerText, "written text");
      assert.strictEqual(text[2].innerText, "more written text");
      assert.strictEqual(text[4].innerText, "and even more");
    });

    test("collapses and expands animated image onebox", async function (assert) {
      this.set("cooked", animatedImageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const animatedOneboxes = queryAll(".animated.onebox");

      assert.strictEqual(animatedOneboxes.length, 2, "two oneboxes rendered");

      await click(
        queryAll(".chat-message-collapser-opened")[0],
        "close first preview"
      );

      assert.false(
        visible(".onebox[src='/images/avatar.png']"),
        "first onebox hidden"
      );
      assert.true(
        visible(".onebox[src='/images/d-logo-sketch-small.png']"),
        "second onebox still visible"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(animatedOneboxes.length, 2, "two oneboxes rendered");

      await click(
        queryAll(".chat-message-collapser-opened")[1],
        "close second preview"
      );

      assert.true(
        visible(".onebox[src='/images/avatar.png']"),
        "first onebox still visible"
      );
      assert.false(
        visible(".onebox[src='/images/d-logo-sketch-small.png']"),
        "second onebox hidden"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(animatedOneboxes.length, 2, "two oneboxes rendered");
    });
  }
);

module(
  "Discourse Chat | Component | chat message collapser external image onebox",
  function (hooks) {
    setupRenderingTest(hooks);

    test("shows links for animated image", async function (assert) {
      this.set("cooked", externalImageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const links = queryAll("a.chat-message-collapser-link-small");

      assert.true(links[0].innerText.trim().includes("http://cat1.com"));
      assert.true(links[0].href.includes("http://cat1.com"));

      assert.true(links[1].innerText.trim().includes("http://cat2.com"));
      assert.true(links[1].href.includes("http://cat2.com"));
    });

    test("shows all user written text", async function (assert) {
      this.set("cooked", externalImageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const text = queryAll(".chat-message-collapser p");

      assert.strictEqual(text.length, 5, "shows all written text");
      assert.strictEqual(text[0].innerText, "written text");
      assert.strictEqual(text[2].innerText, "more written text");
      assert.strictEqual(text[4].innerText, "and even more");
    });

    test("collapses and expands image oneboxes", async function (assert) {
      this.set("cooked", externalImageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const imageOneboxes = queryAll(".onebox");

      assert.strictEqual(imageOneboxes.length, 2, "two oneboxes rendered");

      await click(
        queryAll(".chat-message-collapser-opened")[0],
        "close first preview"
      );

      assert.false(
        visible(".onebox[href='http://cat1.com']"),
        "first onebox hidden"
      );
      assert.true(
        visible(".onebox[href='http://cat2.com']"),
        "second onebox still visible"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(imageOneboxes.length, 2, "two oneboxes rendered");

      await click(
        queryAll(".chat-message-collapser-opened")[1],
        "close second preview"
      );

      assert.true(
        visible(".onebox[href='http://cat1.com']"),
        "first onebox still visible"
      );
      assert.false(
        visible(".onebox[href='http://cat2.com']"),
        "second onebox hidden"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(imageOneboxes.length, 2, "two oneboxes rendered");
    });
  }
);

module(
  "Discourse Chat | Component | chat message collapser images",
  function (hooks) {
    setupRenderingTest(hooks);

    skip("escapes link", async function (assert) {
      this.set(
        "cooked",
        imageCooked
          .replace("shows alt", evilString)
          .replace("/images/d-logo-sketch-small.png", evilString)
      );
      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      assert.true(
        queryAll(".chat-message-collapser-link-small")[0].innerHTML.includes(
          evilStringEscaped
        )
      );
      assert.true(
        queryAll(".chat-message-collapser-link-small")[1].innerHTML.includes(
          "&lt;script&gt;someeviltitle&lt;/script&gt;"
        )
      );
    });

    test("shows alt or links (if no alt) for linked image", async function (assert) {
      this.set("cooked", imageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const links = queryAll("a.chat-message-collapser-link-small");

      assert.true(links[0].innerText.trim().includes("shows alt"));
      assert.true(links[0].href.includes("/images/avatar.png"));

      assert.true(
        links[1].innerText.trim().includes("/images/d-logo-sketch-small.png")
      );
      assert.true(links[1].href.includes("/images/d-logo-sketch-small.png"));
    });

    test("shows all user written text", async function (assert) {
      this.set("cooked", imageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const text = queryAll(".chat-message-collapser p");

      assert.strictEqual(text.length, 6, "shows all written text");
      assert.strictEqual(text[0].innerText, "written text");
      assert.strictEqual(text[2].innerText, "more written text");
      assert.strictEqual(text[4].innerText, "and even more");
    });

    test("collapses and expands images", async function (assert) {
      this.set("cooked", imageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const images = queryAll("img");

      assert.strictEqual(images.length, 3);

      await click(
        queryAll(".chat-message-collapser-opened")[0],
        "close first preview"
      );

      assert.false(
        visible("img[src='/images/avatar.png']"),
        "first image hidden"
      );
      assert.true(
        visible("img[src='/images/d-logo-sketch-small.png']"),
        "second image still visible"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(images.length, 3);

      await click(
        queryAll(".chat-message-collapser-opened")[1],
        "close second preview"
      );

      assert.true(
        visible("img[src='/images/avatar.png']"),
        "first image still visible"
      );
      assert.false(
        visible("img[src='/images/d-logo-sketch-small.png']"),
        "second image hidden"
      );

      await click(".chat-message-collapser-closed");

      assert.strictEqual(images.length, 3);
    });

    test("does not show collapser for emoji images", async function (assert) {
      this.set("cooked", imageCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const links = queryAll("a.chat-message-collapser-link-small");
      const images = queryAll("img");
      const collapser = queryAll(".chat-message-collapser-opened");

      assert.strictEqual(links.length, 2);
      assert.strictEqual(images.length, 3, "shows images and emoji");
      assert.strictEqual(collapser.length, 2);
    });
  }
);

module(
  "Discourse Chat | Component | chat message collapser galleries",
  function (hooks) {
    setupRenderingTest(hooks);

    test("escapes title/link", async function (assert) {
      this.set(
        "cooked",
        galleryCooked
          .replace("https://imgur.com/gallery/yyVx5lJ", evilString)
          .replace("Le tomtom album", evilString)
      );
      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      assert.true(
        query(".chat-message-collapser-link-small").href.includes(
          "%3Cscript%3Esomeeviltitle%3C/script%3E"
        )
      );
      assert.strictEqual(
        query(".chat-message-collapser-link-small").innerHTML.trim(),
        "someeviltitle"
      );
    });

    test("removes album title overlay", async function (assert) {
      this.set("cooked", galleryCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      assert.false(visible(".album-title"), "album title removed");
    });

    test("shows gallery link", async function (assert) {
      this.set("cooked", galleryCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      assert.true(
        query(".chat-message-collapser-link-small").innerText.includes(
          "Le tomtom album"
        )
      );
    });

    test("shows all user written text", async function (assert) {
      this.set("cooked", galleryCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      const text = queryAll(".chat-message-collapser p");

      assert.strictEqual(text.length, 2, "shows all written text");
      assert.strictEqual(text[0].innerText, "written text");
      assert.strictEqual(text[1].innerText, "more written text");
    });

    test("collapses and expands images", async function (assert) {
      this.set("cooked", galleryCooked);

      await render(hbs`<ChatMessageCollapser @cooked={{this.cooked}} />`);

      assert.true(visible("img"), "image visible initially");

      await click(
        queryAll(".chat-message-collapser-opened")[0],
        "close preview"
      );
      assert.false(visible("img"), "image hidden");

      await click(".chat-message-collapser-closed");
      assert.true(visible("img"), "image visible initially");
    });
  }
);
