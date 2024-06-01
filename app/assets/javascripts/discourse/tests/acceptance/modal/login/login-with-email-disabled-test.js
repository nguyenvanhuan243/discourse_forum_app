import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("Login with email disabled", function (needs) {
  needs.settings({
    enable_local_logins_via_email: false,
    enable_facebook_logins: true,
  });

  test("with email button", async function (assert) {
    await visit("/");
    await click("header .login-button");

    assert.ok(
      exists(".btn-social.facebook"),
      "it displays the facebook login button"
    );

    assert.notOk(
      exists("#email-login-link"),
      "it displays the login with email button"
    );
  });
});
