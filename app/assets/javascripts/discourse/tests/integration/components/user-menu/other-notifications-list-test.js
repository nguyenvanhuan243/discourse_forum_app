import { render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import pretender, { response } from "discourse/tests/helpers/create-pretender";
import { exists, query } from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

module(
  "Integration | Component | user-menu | other-notifications-list",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(() => {
      pretender.get("/notifications", () => {
        return response({ notifications: [] });
      });
    });

    const template = hbs`<UserMenu::OtherNotificationsList/>`;

    test("empty state when there are no notifications", async function (assert) {
      await render(template);
      assert.ok(exists(".empty-state .empty-state-body"));
      assert.strictEqual(
        query(".empty-state .empty-state-title").textContent.trim(),
        I18n.t("user.no_other_notifications_title")
      );
    });
  }
);
