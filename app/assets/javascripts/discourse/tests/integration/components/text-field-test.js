import { fillIn, render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import sinon from "sinon";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { exists, query } from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

module("Integration | Component | text-field", function (hooks) {
  setupRenderingTest(hooks);

  test("renders correctly with no properties set", async function (assert) {
    await render(hbs`<TextField />`);

    assert.ok(exists("input[type=text]"));
  });

  test("support a placeholder", async function (assert) {
    sinon.stub(I18n, "t").returnsArg(0);

    await render(hbs`<TextField @placeholderKey="placeholder.i18n.key" />`);

    assert.ok(exists("input[type=text]"));
    assert.strictEqual(query("input").placeholder, "placeholder.i18n.key");
  });

  test("sets the dir attribute to auto when mixed text direction enabled", async function (assert) {
    this.siteSettings.support_mixed_text_direction = true;

    await render(hbs`<TextField @value="זהו שם עברי עם מקום עברי" />`);

    assert.dom("input").hasAttribute("dir", "auto");
  });

  test("supports onChange", async function (assert) {
    this.called = false;
    this.newValue = null;
    this.set("value", "hello");
    this.set("changed", (v) => {
      this.newValue = v;
      this.called = true;
    });

    await render(
      hbs`<TextField class="tf-test" @value={{this.value}} @onChange={{this.changed}} />`
    );

    await fillIn(".tf-test", "hello");
    assert.ok(!this.called);

    await fillIn(".tf-test", "new text");
    assert.ok(this.called);
    assert.strictEqual(this.newValue, "new text");
  });

  test("supports onChangeImmediate", async function (assert) {
    this.called = false;
    this.newValue = null;
    this.set("value", "old");
    this.set("changed", (v) => {
      this.newValue = v;
      this.called = true;
    });

    await render(
      hbs`<TextField class="tf-test" @value={{this.value}} @onChangeImmediate={{this.changed}} />`
    );

    await fillIn(".tf-test", "old");
    assert.ok(!this.called);

    await fillIn(".tf-test", "no longer old");
    assert.ok(this.called);
    assert.strictEqual(this.newValue, "no longer old");
  });
});
