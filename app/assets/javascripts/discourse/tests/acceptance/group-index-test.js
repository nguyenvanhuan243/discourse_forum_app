import { click, currentURL, settled, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  count,
  exists,
  query,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import I18n from "discourse-i18n";

acceptance("Group Members - Anonymous", function () {
  test("Viewing Members as anon user", async function (assert) {
    await visit("/g/discourse");

    assert.strictEqual(
      count(".avatar-flair .d-icon-adjust"),
      1,
      "it displays the group's avatar flair"
    );
    assert.ok(exists(".group-members .group-member"), "it lists group members");

    assert.ok(
      !exists(".group-member-dropdown"),
      "it does not allow anon user to manage group members"
    );

    assert.strictEqual(
      query(".group-username-filter").getAttribute("placeholder"),
      I18n.t("groups.members.filter_placeholder"),
      "it should display the right filter placeholder"
    );
  });
});

acceptance("Group Members", function (needs) {
  needs.user();

  needs.pretender((server, helper) => {
    server.put("/groups/47/owners.json", () => {
      return helper.response({ success: true });
    });
  });

  test("Viewing Members as a group owner", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false });

    await visit("/g/discourse");
    await click(".group-members-add");

    assert.strictEqual(
      count(".user-chooser"),
      1,
      "it should display the add members modal"
    );
  });

  test("Viewing Members as an admin user", async function (assert) {
    await visit("/g/discourse");

    assert.ok(
      exists(".group-member-dropdown"),
      "it allows admin user to manage group members"
    );

    assert.strictEqual(
      query(".group-username-filter").getAttribute("placeholder"),
      I18n.t("groups.members.filter_placeholder_admin"),
      "it should display the right filter placeholder"
    );
  });

  test("Shows bulk actions as an admin user", async function (assert) {
    await visit("/g/discourse");

    await click("button.bulk-select");

    await click(queryAll("input.bulk-select")[0]);
    await click(queryAll("input.bulk-select")[1]);

    const memberDropdown = selectKit(".bulk-group-member-dropdown");
    await memberDropdown.expand();

    assert.ok(
      exists('[data-value="removeMembers"]'),
      "it includes remove member option"
    );

    assert.ok(
      exists('[data-value="makeOwners"]'),
      "it includes make owners option"
    );

    assert.ok(
      exists('[data-value="setPrimary"]'),
      "it includes set primary option"
    );
  });

  test("Shows bulk actions as a group owner", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false });

    await visit("/g/discourse");

    await click("button.bulk-select");

    await click(queryAll("input.bulk-select")[0]);
    await click(queryAll("input.bulk-select")[1]);

    const memberDropdown = selectKit(".bulk-group-member-dropdown");
    await memberDropdown.expand();

    assert.ok(
      exists('[data-value="removeMembers"]'),
      "it includes remove member option"
    );

    assert.ok(
      exists('[data-value="makeOwners"]'),
      "it includes make owners option"
    );

    assert.notOk(
      exists('[data-value="setPrimary"]'),
      "it does not include set primary (staff only) option"
    );
  });

  test("Bulk actions - Menu, Select all and Clear all buttons", async function (assert) {
    await visit("/g/discourse");

    assert.ok(
      !exists(".bulk-select-buttons-wrap details"),
      "it does not show menu button if nothing is selected"
    );

    await click("button.bulk-select");
    await click(".bulk-select-all");

    assert.ok(
      exists(".bulk-select-buttons-wrap details"),
      "it shows menu button if something is selected"
    );
  });
});

/**
 * Workaround for https://github.com/tildeio/router.js/pull/335
 */
async function visitWithRedirects(url) {
  try {
    await visit(url);
  } catch (error) {
    const { message } = error;
    if (message !== "TransitionAborted") {
      throw error;
    }
    await settled();
  }
}

acceptance("Old group route redirections", function () {
  test("/group/discourse is redirected", async function (assert) {
    await visitWithRedirects("/group/discourse");
    assert.strictEqual(currentURL(), "/g/discourse");
  });

  test("/groups/discourse is redirected", async function (assert) {
    await visitWithRedirects("/groups/discourse");
    assert.strictEqual(currentURL(), "/g/discourse");
  });

  test("/groups is redirected", async function (assert) {
    await visitWithRedirects("/groups");
    assert.strictEqual(currentURL(), "/g");
  });
});
