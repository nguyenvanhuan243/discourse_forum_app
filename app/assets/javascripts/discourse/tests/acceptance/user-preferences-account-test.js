import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import sinon from "sinon";
import DiscourseURL from "discourse/lib/url";
import pretender, {
  fixturesByUrl,
  response,
} from "discourse/tests/helpers/create-pretender";
import {
  acceptance,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import { cloneJSON } from "discourse-common/lib/object";
import I18n from "discourse-i18n";

acceptance("User Preferences - Account", function (needs) {
  needs.user({ can_upload_avatar: true });

  let customUserProps = {};
  let pickAvatarRequestData = null;
  let gravatarUploadId = 123456789;

  needs.pretender((server, helper) => {
    server.get("/u/eviltrout.json", () => {
      const json = cloneJSON(fixturesByUrl["/u/eviltrout.json"]);
      json.user.can_edit = true;

      for (const [key, value] of Object.entries(customUserProps)) {
        json.user[key] = value;
      }

      return helper.response(json);
    });

    server.delete("/u/eviltrout.json", () =>
      helper.response({ success: true })
    );

    server.post("/u/eviltrout/preferences/revoke-account", () => {
      return helper.response({
        success: true,
      });
    });

    server.put("/u/eviltrout/preferences/avatar/pick", (request) => {
      pickAvatarRequestData = helper.parsePostData(request.requestBody);
      return helper.response({ success: true });
    });

    server.post("/user_avatar/eviltrout/refresh_gravatar.json", () => {
      return helper.response({
        gravatar_upload_id: gravatarUploadId,
        gravatar_avatar_template: "/images/gravatar_is_not_avatar.png",
      });
    });
  });

  needs.hooks.afterEach(() => {
    customUserProps = {};
    pickAvatarRequestData = null;
  });

  test("changing username", async function (assert) {
    const stub = sinon
      .stub(DiscourseURL, "redirectTo")
      .withArgs("/u/good_trout/preferences");

    pretender.put("/u/eviltrout/preferences/username", (data) => {
      assert.strictEqual(data.requestBody, "new_username=good_trout");

      return response({
        id: fixturesByUrl["/u/eviltrout.json"].user.id,
        username: "good_trout",
      });
    });

    await visit("/u/eviltrout/preferences/account");

    assert.strictEqual(
      query(".username-preference__current-username").innerText,
      "eviltrout"
    );

    await click(".username-preference__edit-username");

    assert.strictEqual(query(".username-preference__input").value, "eviltrout");
    assert.true(query(".username-preference__submit").disabled);

    await fillIn(query(".username-preference__input"), "good_trout");
    assert.false(query(".username-preference__submit").disabled);

    await click(".username-preference__submit");
    await click(".dialog-container .btn-primary");

    sinon.assert.calledOnce(stub);
  });

  test("Delete dialog", async function (assert) {
    sinon.stub(DiscourseURL, "redirectAbsolute");

    customUserProps = {
      can_delete_account: true,
    };

    await visit("/u/eviltrout/preferences/account");
    await click(".delete-account .btn-danger");
    await click(".dialog-footer .btn-danger");

    assert.strictEqual(
      query(".dialog-body").textContent.trim(),
      I18n.t("user.deleted_yourself"),
      "confirmation dialog is shown"
    );

    await click(".dialog-footer .btn-primary");

    assert.ok(
      DiscourseURL.redirectAbsolute.calledWith("/"),
      "redirects to home after deleting"
    );
  });

  test("connected accounts", async function (assert) {
    await visit("/u/eviltrout/preferences/account");

    assert.ok(
      exists(".pref-associated-accounts"),
      "it has the connected accounts section"
    );

    assert.ok(
      query(
        ".pref-associated-accounts table tr:nth-of-type(1) td:nth-of-type(1)"
      ).innerHTML.includes("Facebook"),
      "it lists facebook"
    );

    await click(
      ".pref-associated-accounts table tr:nth-of-type(1) td:last-child button"
    );

    assert.ok(
      query(
        ".pref-associated-accounts table tr:nth-of-type(1) td:last-of-type"
      ).innerHTML.includes("Connect")
    );
  });

  test("avatars are selectable for staff user when `selectable_avatars_mode` site setting is set to `staff`", async function (assert) {
    this.siteSettings.selectable_avatars_mode = "staff";

    customUserProps = {
      moderator: true,
      admin: false,
    };

    await visit("/u/eviltrout/preferences/account");
    await click(".pref-avatar .btn");

    assert.ok(
      exists(".selectable-avatars"),
      "opens the avatar selection modal"
    );

    assert.ok(
      exists("#uploaded-avatar"),
      "avatar selection modal includes option to upload"
    );
  });

  test("avatars are not selectable for non-staff user when `selectable_avatars_mode` site setting is set to `staff`", async function (assert) {
    this.siteSettings.selectable_avatars_mode = "staff";

    customUserProps = {
      moderator: false,
      admin: false,
    };

    await visit("/u/eviltrout/preferences/account");
    await click(".pref-avatar .btn");

    assert.ok(
      exists(".selectable-avatars"),
      "opens the avatar selection modal"
    );

    assert.notOk(
      exists("#uploaded-avatar"),
      "avatar selection modal does not include option to upload"
    );
  });

  test("avatars not selectable when `selectable_avatars_mode` site setting is set to `no_one`", async function (assert) {
    this.siteSettings.selectable_avatars_mode = "no_one";

    customUserProps = {
      admin: true,
    };

    await visit("/u/eviltrout/preferences/account");
    await click(".pref-avatar .btn");

    assert.ok(
      exists(".selectable-avatars"),
      "opens the avatar selection modal"
    );

    assert.notOk(
      exists("#uploaded-avatar"),
      "avatar selection modal does not include option to upload"
    );
  });

  test("avatars are selectable for user with required trust level when `selectable_avatars_mode` site setting is set to `tl3`", async function (assert) {
    this.siteSettings.selectable_avatars_mode = "tl3";

    customUserProps = {
      trust_level: 3,
      moderator: false,
      admin: false,
    };

    await visit("/u/eviltrout/preferences/account");
    await click(".pref-avatar .btn");

    assert.ok(
      exists(".selectable-avatars"),
      "opens the avatar selection modal"
    );

    assert.ok(
      exists("#uploaded-avatar"),
      "avatar selection modal includes option to upload"
    );
  });

  test("avatars are not selectable for user without required trust level when `selectable_avatars_mode` site setting is set to `tl3`", async function (assert) {
    this.siteSettings.selectable_avatars_mode = "tl3";

    customUserProps = {
      trust_level: 2,
      moderator: false,
      admin: false,
    };

    await visit("/u/eviltrout/preferences/account");
    await click(".pref-avatar .btn");

    assert.ok(
      exists(".selectable-avatars"),
      "opens the avatar selection modal"
    );

    assert.notOk(
      exists("#uploaded-avatar"),
      "avatar selection modal does not include option to upload"
    );
  });

  test("avatars are selectable for staff user when `selectable_avatars_mode` site setting is set to `tl3`", async function (assert) {
    this.siteSettings.selectable_avatars_mode = "tl3";

    customUserProps = {
      trust_level: 2,
      moderator: true,
      admin: false,
    };

    await visit("/u/eviltrout/preferences/account");
    await click(".pref-avatar .btn");

    assert.ok(
      exists(".selectable-avatars"),
      "opens the avatar selection modal"
    );

    assert.ok(
      exists("#uploaded-avatar"),
      "avatar selection modal includes option to upload"
    );
  });

  test("default avatar selector", async function (assert) {
    await visit("/u/eviltrout/preferences/account");
    await click(".pref-avatar .btn");

    assert.ok(exists(".avatar-choice"), "opens the avatar selection modal");

    await click(".avatar-selector-refresh-gravatar");

    assert.ok(
      exists(".avatar[src='/images/gravatar_is_not_avatar.png']"),
      "displays the new gravatar image"
    );

    await click("#gravatar");
    await click(".d-modal__footer .btn");

    assert.deepEqual(
      pickAvatarRequestData,
      {
        type: "gravatar",
        upload_id: `${gravatarUploadId}`,
      },
      "includes the right pick avatar request params"
    );
  });
});

acceptance("User Preferences — Account - Download Archive", function (needs) {
  const currentUser = "eviltrout";
  needs.user();
  needs.pretender((server, helper) => {
    server.post("/export_csv/export_entity.json", () => {
      return helper.response({});
    });
  });

  test("Can see and trigger download for account data", async function (assert) {
    await visit(`/u/${currentUser}/preferences/account`);

    assert.ok(query(".btn-request-archive"), "button exists");

    await click(".btn-request-archive");
    await click("#dialog-holder .btn-primary");

    assert.equal(
      query(".dialog-body").innerText.trim(),
      I18n.t("user.download_archive.success")
    );

    await click("#dialog-holder .btn-primary");
  });
});
