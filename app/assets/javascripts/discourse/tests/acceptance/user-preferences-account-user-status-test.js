import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  exists,
  query,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";

async function openUserStatusModal() {
  await click(".pref-user-status .btn-default");
}

async function pickEmoji(emoji) {
  await click(".btn-emoji");
  await fillIn(".emoji-picker-content .filter", emoji);
  await click(".results .emoji");
}

async function setStatus(status) {
  await openUserStatusModal();
  await pickEmoji(status.emoji);
  await fillIn(".user-status-description", status.description);
  await click(".d-modal__footer .btn-primary"); // save and close modal
}

acceptance("User Profile - Account - User Status", function (needs) {
  const username = "eviltrout";
  const status = {
    emoji: "tooth",
    description: "off to dentist",
  };

  needs.user({ username, status });

  test("doesn't render status block if status is disabled in site settings", async function (assert) {
    this.siteSettings.enable_user_status = false;
    await visit(`/u/${username}/preferences/account`);
    assert.notOk(exists(".pref-user-status"));
  });

  test("renders status block if status is enabled in site settings", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit(`/u/${username}/preferences/account`);

    assert.ok(
      exists(".pref-user-status .user-status-message"),
      "status is shown"
    );
    assert.ok(
      exists(`.pref-user-status .emoji[alt='${status.emoji}']`),
      "status emoji is correct"
    );
    assert.equal(
      query(
        `.pref-user-status .user-status-message-description`
      ).innerText.trim(),
      status.description,
      "status description is correct"
    );
  });

  test("doesn't show the pause notifications control group on the user status modal", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit(`/u/${username}/preferences/account`);
    await openUserStatusModal();

    assert.dom(".pause-notifications").doesNotExist();
  });

  test("the status modal sets status", async function (assert) {
    this.siteSettings.enable_user_status = true;
    updateCurrentUser({ status: null });

    await visit(`/u/${username}/preferences/account`);
    assert.notOk(
      exists(".pref-user-status .user-status-message"),
      "status isn't shown"
    );

    await setStatus(status);

    assert.ok(
      exists(".pref-user-status .user-status-message"),
      "status is shown"
    );
    assert.ok(
      exists(`.pref-user-status .emoji[alt='${status.emoji}']`),
      "status emoji is correct"
    );
    assert.equal(
      query(
        `.pref-user-status .user-status-message-description`
      ).innerText.trim(),
      status.description,
      "status description is correct"
    );
  });

  test("the status modal updates status", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit(`/u/${username}/preferences/account`);
    const newStatus = { emoji: "surfing_man", description: "surfing" };
    await setStatus(newStatus);

    assert.ok(
      exists(".pref-user-status .user-status-message"),
      "status is shown"
    );
    assert.ok(
      exists(`.pref-user-status .emoji[alt='${newStatus.emoji}']`),
      "status emoji is correct"
    );
    assert.equal(
      query(
        `.pref-user-status .user-status-message-description`
      ).innerText.trim(),
      newStatus.description,
      "status description is correct"
    );
  });

  test("the status modal clears status", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit(`/u/${username}/preferences/account`);
    await openUserStatusModal();
    await click(".btn.delete-status");

    assert.notOk(
      exists(".pref-user-status .user-status-message"),
      "status isn't shown"
    );
  });
});
