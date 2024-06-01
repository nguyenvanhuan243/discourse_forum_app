import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, query } from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

function assertNoSecondary(assert) {
  assert.strictEqual(
    query(".display-row.email .value a").innerText,
    "eviltrout@example.com",
    "it should display the primary email"
  );

  assert.strictEqual(
    query(".display-row.secondary-emails .value").innerText.trim(),
    I18n.t("user.email.no_secondary"),
    "it should not display secondary emails"
  );
}

function assertMultipleSecondary(assert, firstEmail, secondEmail) {
  assert.strictEqual(
    query(".display-row.secondary-emails .value li:first-of-type a").innerText,
    firstEmail,
    "it should display the first secondary email"
  );

  assert.strictEqual(
    query(".display-row.secondary-emails .value li:last-of-type a").innerText,
    secondEmail,
    "it should display the second secondary email"
  );
}

acceptance("Admin - User Emails", function (needs) {
  needs.user();

  test("viewing self without secondary emails", async function (assert) {
    await visit("/admin/users/1/eviltrout");

    assertNoSecondary(assert);
  });

  test("viewing self with multiple secondary emails", async function (assert) {
    await visit("/admin/users/3/markvanlan");

    assert.strictEqual(
      query(".display-row.email .value a").innerText,
      "markvanlan@example.com",
      "it should display the user's primary email"
    );

    assertMultipleSecondary(
      assert,
      "markvanlan1@example.com",
      "markvanlan2@example.com"
    );
  });

  test("viewing another user with no secondary email", async function (assert) {
    await visit("/admin/users/1234/regular");
    await click(`.display-row.secondary-emails button`);

    assertNoSecondary(assert);
  });

  test("viewing another account with secondary emails", async function (assert) {
    await visit("/admin/users/1235/regular1");
    await click(`.display-row.secondary-emails button`);

    assertMultipleSecondary(
      assert,
      "regular2alt1@example.com",
      "regular2alt2@example.com"
    );
  });
});
