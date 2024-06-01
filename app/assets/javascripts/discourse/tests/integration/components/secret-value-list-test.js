import { blur, click, fillIn, render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { count, exists, query } from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

module("Integration | Component | secret-value-list", function (hooks) {
  setupRenderingTest(hooks);

  test("adding a value", async function (assert) {
    await render(hbs`<SecretValueList @values={{this.values}} />`);

    this.set("values", "firstKey|FirstValue\nsecondKey|secondValue");

    await fillIn(".new-value-input.key", "thirdKey");
    await click(".add-value-btn");

    assert.strictEqual(
      count(".values .value"),
      2,
      "it doesn't add the value to the list if secret is missing"
    );

    await fillIn(".new-value-input.key", "");
    await fillIn(".new-value-input.secret", "thirdValue");
    await click(".add-value-btn");

    assert.strictEqual(
      count(".values .value"),
      2,
      "it doesn't add the value to the list if key is missing"
    );

    await fillIn(".new-value-input.key", "thirdKey");
    await fillIn(".new-value-input.secret", "thirdValue");
    await click(".add-value-btn");

    assert.strictEqual(
      count(".values .value"),
      3,
      "it adds the value to the list of values"
    );

    assert.deepEqual(
      this.values,
      "firstKey|FirstValue\nsecondKey|secondValue\nthirdKey|thirdValue",
      "it adds the value to the list of values"
    );
  });

  test("adding an invalid value", async function (assert) {
    await render(hbs`<SecretValueList @values={{this.values}} />`);

    await fillIn(".new-value-input.key", "someString");
    await fillIn(".new-value-input.secret", "keyWithAPipe|Hidden");
    await click(".add-value-btn");

    assert.ok(
      !exists(".values .value"),
      "it doesn't add the value to the list of values"
    );

    assert.deepEqual(
      this.values,
      undefined,
      "it doesn't add the value to the list of values"
    );

    assert.ok(
      query(".validation-error").innerText.includes(
        I18n.t("admin.site_settings.secret_list.invalid_input")
      ),
      "it shows validation error"
    );
  });

  test("changing a value", async function (assert) {
    await render(hbs`<SecretValueList @values={{this.values}} />`);

    this.set("values", "firstKey|FirstValue\nsecondKey|secondValue");

    await fillIn(
      ".values .value[data-index='1'] .value-input:first-of-type",
      "changedKey"
    );
    await blur(".values .value[data-index='1'] .value-input:first-of-type");

    assert.strictEqual(
      query(".values .value[data-index='1'] .value-input:first-of-type").value,
      "changedKey"
    );

    await fillIn(
      ".values .value[data-index='1'] .value-input:last-of-type",
      "changedValue"
    );
    await blur(".values .value[data-index='1'] .value-input:last-of-type");

    assert.strictEqual(
      query(".values .value[data-index='1'] .value-input:last-of-type").value,
      "changedValue"
    );
    assert.deepEqual(
      this.values,
      "firstKey|FirstValue\nchangedKey|changedValue",
      "updates the value list"
    );
  });

  test("removing a value", async function (assert) {
    await render(hbs`<SecretValueList @values={{this.values}} />`);

    this.set("values", "firstKey|FirstValue\nsecondKey|secondValue");

    await click(".values .value[data-index='0'] .remove-value-btn");

    assert.strictEqual(
      count(".values .value"),
      1,
      "it removes the value from the list of values"
    );

    assert.strictEqual(
      this.values,
      "secondKey|secondValue",
      "it removes the expected value"
    );
  });
});
