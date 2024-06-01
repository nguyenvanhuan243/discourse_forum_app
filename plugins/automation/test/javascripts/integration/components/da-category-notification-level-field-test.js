import { getOwner } from "@ember/application";
import { render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import AutomationFabricators from "discourse/plugins/automation/admin/lib/fabricators";

module(
  "Integration | Component | da-category-notification-level-field",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.automation = new AutomationFabricators(getOwner(this)).automation();
    });

    test("set value", async function (assert) {
      this.field = new AutomationFabricators(getOwner(this)).field({
        component: "category_notification_level",
      });

      await render(
        hbs`<AutomationField @automation={{this.automation}} @field={{this.field}} />`
      );

      await selectKit().expand();
      await selectKit().selectRowByValue(2);

      assert.strictEqual(this.field.metadata.value, 2);
    });
  }
);
