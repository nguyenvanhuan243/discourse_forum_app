import { click, triggerKeyEvent, visit } from "@ember/test-helpers";
import { test } from "qunit";
import sinon from "sinon";
import KeyboardShortcuts from "discourse/lib/keyboard-shortcuts";
import { withPluginApi } from "discourse/lib/plugin-api";
import {
  acceptance,
  count,
  exists,
} from "discourse/tests/helpers/qunit-helpers";

acceptance("Plugin Keyboard Shortcuts - Logged In", function (needs) {
  needs.user();

  test("a plugin can add a keyboard shortcut", async function (assert) {
    withPluginApi("0.8.38", (api) => {
      api.addKeyboardShortcut("]", () => {
        document.querySelector(
          "#qunit-fixture"
        ).innerHTML = `<div id="added-element">Test adding plugin shortcut</div>`;
      });
    });

    await visit("/t/this-is-a-test-topic/9");
    await triggerKeyEvent(document, "keypress", "]".charCodeAt(0));

    assert.ok(
      document.querySelector("#added-element"),
      "the keyboard shortcut callback fires successfully"
    );
  });
});

acceptance("Plugin Keyboard Shortcuts - Anonymous", function () {
  test("a plugin can add a keyboard shortcut with an option", async function (assert) {
    let spy = sinon.spy(KeyboardShortcuts, "_bindToPath");
    withPluginApi("0.8.38", (api) => {
      api.addKeyboardShortcut("]", () => {}, {
        anonymous: true,
        path: "test-path",
      });
    });

    assert.ok(
      spy.calledWith("test-path", "]"),
      "bindToPath is called due to options provided"
    );
  });

  test("a plugin can add a shortcut and create a new category in the shortcut help modal", async function (assert) {
    withPluginApi("0.8.38", (api) => {
      api.addKeyboardShortcut("meta+]", () => {}, {
        help: {
          category: "new_category",
          name: "new_category.test",
          definition: {
            keys1: ["meta", "]"],
            keys2: ["meta", "["],
            keysDelimiter: "plus",
            shortcutsDelimiter: "slash",
          },
        },
      });
    });
    await visit("/");
    await triggerKeyEvent(document, "keypress", "?".charCodeAt(0));

    assert.ok(exists(".shortcut-category-new_category"));
    assert.strictEqual(count(".shortcut-category-new_category li"), 1);
  });

  test("a plugin can add a shortcut to and existing category in the shortcut help modal", async function (assert) {
    await visit("/");
    await triggerKeyEvent(document, "keypress", "?".charCodeAt(0));
    const countBefore = count(".shortcut-category-application li");
    await click(".modal-close");

    withPluginApi("0.8.38", (api) => {
      api.addKeyboardShortcut("meta+]", () => {}, {
        help: {
          category: "application",
          name: "application.test",
          definition: {
            keys1: ["]"],
          },
        },
      });
    });

    await triggerKeyEvent(document, "keypress", "?".charCodeAt(0));
    assert.strictEqual(
      count(".shortcut-category-application li"),
      countBefore + 1
    );
  });
});
