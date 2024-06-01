import { click, fillIn, triggerKeyEvent, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  count,
  exists,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

acceptance("Admin - Watched Words", function (needs) {
  needs.user();

  test("list words in groups", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");

    assert.ok(!exists(".admin-watched-words .alert-error"));

    assert.ok(
      !exists(".watched-words-list"),
      "Don't show bad words by default."
    );

    assert.ok(
      !exists(".watched-words-list .watched-word"),
      "Don't show bad words by default."
    );

    await fillIn(".admin-controls .controls input[type=text]", "li");

    assert.strictEqual(
      count(".watched-words-list .watched-word"),
      1,
      "When filtering, show words even if checkbox is unchecked."
    );

    await fillIn(".admin-controls .controls input[type=text]", "");

    assert.ok(
      !exists(".watched-words-list .watched-word"),
      "Clearing the filter hides words again."
    );

    await click(".show-words-checkbox");

    assert.ok(
      exists(".watched-words-list .watched-word"),
      "Always show the words when checkbox is checked."
    );

    await click(".nav-stacked .censor a");

    assert.ok(exists(".watched-words-list"));
    assert.ok(!exists(".watched-words-list .watched-word"), "Empty word list.");
  });

  test("add words", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");
    const submitButton = query(".watched-word-form button");

    await click(".show-words-checkbox");
    await click(".select-kit-header.multi-select-header");

    await fillIn(".select-kit-filter input", "poutine");
    await triggerKeyEvent(".select-kit-filter input", "keydown", "Enter");

    await fillIn(".select-kit-filter input", "cheese");
    await triggerKeyEvent(".select-kit-filter input", "keydown", "Enter");

    assert.equal(
      query(".select-kit-header-wrapper .formatted-selection").innerText,
      "poutine, cheese",
      "has the correct words in the input field"
    );

    await click(submitButton);

    const words = [...queryAll(".watched-words-list .watched-word")].map(
      (elem) => {
        return elem.innerText.trim();
      }
    );

    assert.ok(words.includes("poutine"), "has word 'poutine'");
    assert.ok(words.includes("cheese"), "has word 'cheese'");
    assert.equal(count(".watched-words-list .case-sensitive"), 0);
  });

  test("add case-sensitive words", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");
    const submitButton = query(".watched-word-form button");
    assert.strictEqual(
      submitButton.disabled,
      true,
      "Add button is disabled by default"
    );
    await click(".show-words-checkbox");

    await click(".select-kit-header.multi-select-header");
    await fillIn(".select-kit-filter input", "Discourse");
    await triggerKeyEvent(".select-kit-filter input", "keydown", "Enter");

    await click(".case-sensitivity-checkbox");
    assert.strictEqual(
      submitButton.disabled,
      false,
      "Add button should no longer be disabled after input is filled"
    );
    await click(submitButton);

    assert
      .dom(".watched-words-list .watched-word")
      .hasText(`Discourse ${I18n.t("admin.watched_words.case_sensitive")}`);

    await click(".select-kit-header.multi-select-header");
    await fillIn(".select-kit-filter input", "discourse");
    await triggerKeyEvent(".select-kit-filter input", "keydown", "Enter");
    await click(".case-sensitivity-checkbox");
    await click(submitButton);

    assert
      .dom(".watched-words-list .watched-word")
      .hasText(`discourse ${I18n.t("admin.watched_words.case_sensitive")}`);
  });

  test("remove words", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");
    await click(".show-words-checkbox");

    let wordId = null;

    [...queryAll(".watched-words-list .watched-word")].forEach((elem) => {
      if (elem.innerText.trim() === "anise") {
        wordId = elem.getAttribute("id");
      }
    });

    await click(`#${wordId} .delete-word-record`);

    assert.strictEqual(count(".watched-words-list .watched-word"), 2);
  });

  test("test modal - replace", async function (assert) {
    await visit("/admin/customize/watched_words/action/replace");
    await click(".watched-word-test");
    await fillIn(".d-modal__body textarea", "Hi there!");
    assert.strictEqual(query(".d-modal__body li .match").innerText, "Hi");
    assert.strictEqual(
      query(".d-modal__body li .replacement").innerText,
      "hello"
    );
  });

  test("test modal - tag", async function (assert) {
    await visit("/admin/customize/watched_words/action/tag");
    await click(".watched-word-test");
    await fillIn(".d-modal__body textarea", "Hello world!");
    assert.strictEqual(query(".d-modal__body li .match").innerText, "Hello");
    assert.strictEqual(query(".d-modal__body li .tag").innerText, "greeting");
  });
});

acceptance("Admin - Watched Words - Emoji Replacement", function (needs) {
  needs.user();
  needs.site({
    watched_words_replace: {
      "(?:\\W|^)(betis)(?=\\W|$)": {
        replacement: ":poop:",
        case_sensitive: false,
      },
    },
  });

  test("emoji renders successfully after replacement", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("button.reply-to-post");
    await fillIn(".d-editor-input", "betis betis betis");
    const cooked = query(".d-editor-preview p");
    const cookedChildren = Array.from(cooked.children);
    const emojis = cookedChildren.filter((child) => child.nodeName === "IMG");
    assert.strictEqual(emojis.length, 3, "three emojis have been rendered");
    assert.strictEqual(
      emojis.every((emoji) => emoji.title === ":poop:"),
      true,
      "all emojis are :poop:"
    );
  });
});

acceptance("Admin - Watched Words - Bad regular expressions", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    server.get("/admin/customize/watched_words.json", () => {
      return helper.response({
        actions: ["block", "censor", "require_approval", "flag", "replace"],
        words: [
          {
            id: 1,
            word: "[.*",
            regexp: "[.*",
            action: "block",
          },
        ],
        compiled_regular_expressions: {
          block: null,
          censor: null,
          require_approval: null,
          flag: null,
          replace: null,
        },
      });
    });
  });

  test("shows an error message if regex is invalid", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");
    assert.strictEqual(count(".admin-watched-words .alert-error"), 1);
  });
});
