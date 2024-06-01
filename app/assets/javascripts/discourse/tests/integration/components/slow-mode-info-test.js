import { render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { count, exists } from "discourse/tests/helpers/qunit-helpers";

module("Integration | Component | slow-mode-info", function (hooks) {
  setupRenderingTest(hooks);

  test("doesn't render if the topic is closed", async function (assert) {
    this.set("topic", { slow_mode_seconds: 3600, closed: true });

    await render(hbs`<SlowModeInfo @topic={{this.topic}} />`);

    assert.ok(!exists(".slow-mode-heading"), "it doesn't render the notice");
  });

  test("doesn't render if the slow mode is disabled", async function (assert) {
    this.set("topic", { slow_mode_seconds: 0, closed: false });

    await render(hbs`<SlowModeInfo @topic={{this.topic}} />`);

    assert.ok(!exists(".slow-mode-heading"), "it doesn't render the notice");
  });

  test("renders if slow mode is enabled", async function (assert) {
    this.set("topic", { slow_mode_seconds: 3600, closed: false });

    await render(hbs`<SlowModeInfo @topic={{this.topic}} />`);

    assert.strictEqual(count(".slow-mode-heading"), 1);
  });

  test("staff and TL4 users can disable slow mode", async function (assert) {
    this.setProperties({
      topic: { slow_mode_seconds: 3600, closed: false },
      user: { canManageTopic: true },
    });

    await render(
      hbs`<SlowModeInfo @topic={{this.topic}} @user={{this.user}} />`
    );

    assert.strictEqual(count(".slow-mode-remove"), 1);
  });

  test("regular users can't disable slow mode", async function (assert) {
    this.setProperties({
      topic: { slow_mode_seconds: 3600, closed: false },
      user: { canManageTopic: false },
    });

    await render(
      hbs`<SlowModeInfo @topic={{this.topic}} @user={{this.user}} />`
    );

    assert.ok(
      !exists(".slow-mode-remove"),
      "it doesn't let you disable slow mode"
    );
  });
});
