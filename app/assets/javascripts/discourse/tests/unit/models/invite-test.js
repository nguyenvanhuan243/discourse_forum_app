import { getOwner } from "@ember/application";
import { setupTest } from "ember-qunit";
import { module, test } from "qunit";

module("Unit | Model | invite", function (hooks) {
  setupTest(hooks);

  test("create", function (assert) {
    const store = getOwner(this).lookup("service:store");
    assert.ok(
      store.createRecord("invite"),
      "it can be created without arguments"
    );
  });
});
