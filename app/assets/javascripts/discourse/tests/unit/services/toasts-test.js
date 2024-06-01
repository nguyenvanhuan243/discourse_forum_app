import { getOwner } from "@ember/application";
import { setupTest } from "ember-qunit";
import { module, test } from "qunit";

module("Unit | Service | Toasts", function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    this.toasts = getOwner(this).lookup("service:toasts");
  });

  test("views option", async function (assert) {
    this.toasts.show({ views: ["desktop"], data: { text: "foo" } });

    assert.deepEqual(this.toasts.activeToasts.length, 1);

    this.toasts.show({ views: ["mobile"], data: { text: "foo" } });

    assert.ok(this.toasts.activeToasts.length < 2);
  });
});
