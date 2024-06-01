import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  exists,
  fakeTime,
  loggedInUser,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

acceptance("Invites - Create & Edit Invite Modal", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    const inviteData = {
      id: 1,
      invite_key: "52641ae8878790bc7b79916247cfe6ba",
      link: "http://example.com/invites/52641ae8878790bc7b79916247cfe6ba",
      max_redemptions_allowed: 1,
      redemption_count: 0,
      created_at: "2021-01-26T12:00:00.000Z",
      updated_at: "2021-01-26T12:00:00.000Z",
      expires_at: "2121-01-26T12:00:00.000Z",
      expired: false,
      topics: [],
      groups: [],
    };

    server.post("/invites", () => helper.response(inviteData));
    server.put("/invites/1", (request) => {
      const data = helper.parsePostData(request.requestBody);
      if (data.email === "error") {
        return helper.response(422, {
          errors: ["error isn't a valid email address."],
        });
      } else {
        return helper.response(inviteData);
      }
    });

    server.delete("/invites", () => {
      return helper.response({});
    });
  });

  test("basic functionality", async function (assert) {
    await visit("/u/eviltrout/invited/pending");
    await click(".user-invite-buttons .btn:first-child");

    await assert.ok(exists(".invite-to-groups"));
    await assert.ok(exists(".invite-to-topic"));
    await assert.ok(exists(".invite-expires-at"));
  });

  test("saving", async function (assert) {
    await visit("/u/eviltrout/invited/pending");
    await click(".user-invite-buttons .btn:first-child");

    assert
      .dom("table.user-invite-list tbody tr")
      .exists({ count: 3 }, "is seeded with three rows");

    await click(".btn-primary");

    assert
      .dom("table.user-invite-list tbody tr")
      .exists({ count: 4 }, "gets added to the list");
  });

  test("copying saves invite", async function (assert) {
    await visit("/u/eviltrout/invited/pending");
    await click(".user-invite-buttons .btn:first-child");

    await click(".save-invite");
    assert.ok(exists(".invite-link .btn"));
  });
});

acceptance("Invites - Link Invites", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    const inviteData = {
      id: 1,
      invite_key: "52641ae8878790bc7b79916247cfe6ba",
      link: "http://example.com/invites/52641ae8878790bc7b79916247cfe6ba",
      max_redemptions_allowed: 1,
      redemption_count: 0,
      created_at: "2021-01-26T12:00:00.000Z",
      updated_at: "2021-01-26T12:00:00.000Z",
      expires_at: "2121-01-26T12:00:00.000Z",
      expired: false,
      topics: [],
      groups: [],
    };

    server.post("/invites", () => helper.response(inviteData));
    server.put("/invites/1", () => helper.response(inviteData));
    server.delete("/invites", () => helper.response({}));
  });

  test("invite links", async function (assert) {
    await visit("/u/eviltrout/invited/pending");
    await click(".user-invite-buttons .btn:first-child");

    assert.ok(exists("#invite-max-redemptions"), "shows max redemptions field");
  });
});

acceptance("Invites - Email Invites", function (needs) {
  let lastRequest;

  needs.user();
  needs.pretender((server, helper) => {
    const inviteData = {
      id: 1,
      invite_key: "52641ae8878790bc7b79916247cfe6ba",
      link: "http://example.com/invites/52641ae8878790bc7b79916247cfe6ba",
      email: "test@example.com",
      emailed: false,
      custom_message: null,
      created_at: "2021-01-26T12:00:00.000Z",
      updated_at: "2021-01-26T12:00:00.000Z",
      expires_at: "2121-01-26T12:00:00.000Z",
      expired: false,
      topics: [],
      groups: [],
    };

    server.post("/invites", (request) => {
      lastRequest = request;
      return helper.response(inviteData);
    });

    server.put("/invites/1", (request) => {
      lastRequest = request;
      return helper.response(inviteData);
    });
  });
  needs.hooks.beforeEach(() => {
    lastRequest = null;
  });

  test("invite email", async function (assert) {
    await visit("/u/eviltrout/invited/pending");
    await click(".user-invite-buttons .btn:first-child");

    assert.ok(exists("#invite-email"), "shows email field");
    await fillIn("#invite-email", "test@example.com");

    assert.ok(exists(".save-invite"), "shows save without email button");
    await click(".save-invite");
    assert.ok(
      lastRequest.requestBody.includes("skip_email=true"),
      "sends skip_email to server"
    );

    await fillIn("#invite-email", "test2@example.com ");
    assert.ok(exists(".send-invite"), "shows save and send email button");
    await click(".send-invite");
    assert.ok(
      lastRequest.requestBody.includes("send_email=true"),
      "sends send_email to server"
    );
  });
});

acceptance(
  "Invites - Create & Edit Invite Modal - timeframe choosing",
  function (needs) {
    let clock = null;

    needs.user();
    needs.pretender((server, helper) => {
      const inviteData = {
        id: 1,
        invite_key: "52641ae8878790bc7b79916247cfe6ba",
        link: "http://example.com/invites/52641ae8878790bc7b79916247cfe6ba",
        max_redemptions_allowed: 1,
        redemption_count: 0,
        created_at: "2021-01-26T12:00:00.000Z",
        updated_at: "2021-01-26T12:00:00.000Z",
        expires_at: "2121-01-26T12:00:00.000Z",
        expired: false,
        topics: [],
        groups: [],
      };

      server.post("/invites", () => helper.response(inviteData));
      server.put("/invites/1", () => helper.response(inviteData));
    });

    needs.hooks.beforeEach(() => {
      const timezone = loggedInUser().user_option.timezone;
      clock = fakeTime("2100-05-03T08:00:00", timezone, true); // Monday morning
    });

    needs.hooks.afterEach(() => {
      clock.restore();
    });

    test("shows correct timeframe options", async function (assert) {
      await visit("/u/eviltrout/invited/pending");

      await click(".user-invite-buttons .btn:first-child");
      await click(".future-date-input-selector-header");

      const options = Array.from(
        queryAll(`ul.select-kit-collection li span.name`).map((_, x) =>
          x.innerText.trim()
        )
      );

      const expected = [
        I18n.t("time_shortcut.later_today"),
        I18n.t("time_shortcut.tomorrow"),
        I18n.t("time_shortcut.later_this_week"),
        I18n.t("time_shortcut.start_of_next_business_week_alt"),
        I18n.t("time_shortcut.two_weeks"),
        I18n.t("time_shortcut.next_month"),
        I18n.t("time_shortcut.two_months"),
        I18n.t("time_shortcut.three_months"),
        I18n.t("time_shortcut.four_months"),
        I18n.t("time_shortcut.six_months"),
        I18n.t("time_shortcut.custom"),
      ];

      assert.deepEqual(options, expected, "options are correct");
    });
  }
);

acceptance(
  "Invites - Create Invite on Site with must_approve_users Setting",
  function (needs) {
    needs.user();
    needs.settings({ must_approve_users: true });

    test("hides `Arrive at Topic` field on sites with `must_approve_users`", async function (assert) {
      await visit("/u/eviltrout/invited/pending");
      await click(".user-invite-buttons .btn:first-child");
      assert.ok(!exists(".invite-to-topic"));
    });
  }
);

acceptance(
  "Invites - Populates Edit Invite Form with saved invite data",
  function (needs) {
    needs.user();
    needs.pretender((server, helper) => {
      server.get("/groups/search.json", () => {
        return helper.response([
          {
            id: 41,
            automatic: false,
            name: "Macdonald",
          },
          {
            id: 47, // must match group-fixtures.js because lookup is by ID
            automatic: false,
            name: "Discourse",
          },
        ]);
      });

      server.post("/invites", () => helper.response({}));
    });

    test("shows correct saved data in form", async function (assert) {
      await visit("/u/eviltrout/invited/pending");
      await click(
        ".user-invite-list tbody tr:nth-child(3) .invite-actions .btn:first-child"
      ); // third invite edit button
      assert.dom("#invite-max-redemptions").hasValue("10");
      assert
        .dom(".invite-to-topic .name")
        .hasText("Welcome to Discourse! :wave:");
      assert.dom(".invite-to-groups .formatted-selection").hasText("Macdonald");
      assert.dom("#invite-email").hasValue("cat.com");
    });

    test("shows correct saved data in group invite form", async function (assert) {
      await visit("/g/discourse");
      await click(".group-members-invite");
      assert.dom(".invite-to-groups .formatted-selection").hasText("Discourse");

      await click(".save-invite");
    });
  }
);
