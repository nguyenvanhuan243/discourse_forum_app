import { render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { query } from "discourse/tests/helpers/qunit-helpers";

module("Integration | Component | empty-state", function (hooks) {
  setupRenderingTest(hooks);

  test("it renders", async function (assert) {
    await render(hbs`<EmptyState @title="title" @body="body" />`);

    assert.strictEqual(query("[data-test-title]").textContent, "title");
    assert.strictEqual(query("[data-test-body]").textContent, "body");
  });
});
