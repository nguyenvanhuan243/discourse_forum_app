import { click, triggerKeyEvent, visit } from "@ember/test-helpers";
import { test } from "qunit";
import topicFixtures from "discourse/tests/fixtures/topic";
import {
  acceptance,
  exists,
  query,
  queryAll,
  selectText,
} from "discourse/tests/helpers/qunit-helpers";
import { cloneJSON } from "discourse-common/lib/object";
import I18n from "discourse-i18n";

acceptance("Topic - Quote button - logged in", function (needs) {
  needs.user();
  needs.settings({
    share_quote_visibility: "anonymous",
    share_quote_buttons: "twitter|email",
  });

  needs.pretender((server, helper) => {
    server.get("/inline-onebox", () =>
      helper.response({
        "inline-oneboxes": [
          {
            url: "http://www.example.com/57350945",
            title: "This is a great title",
          },
        ],
      })
    );
  });

  test("Does not show the quote share buttons by default", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 blockquote");
    assert.ok(exists(".insert-quote"), "it shows the quote button");
    assert.ok(!exists(".quote-sharing"), "it does not show quote sharing");
  });

  test("Shows quote share buttons with the right site settings", async function (assert) {
    this.siteSettings.share_quote_visibility = "all";

    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 blockquote");

    assert.ok(exists(".quote-sharing"), "it shows the quote sharing options");
    assert.ok(
      exists(`.quote-sharing .btn[title='${I18n.t("share.twitter")}']`),
      "it includes the twitter share button"
    );
    assert.ok(
      exists(`.quote-sharing .btn[title='${I18n.t("share.email")}']`),
      "it includes the email share button"
    );
  });

  test("Quoting a Onebox should not copy the formatting of the rendered Onebox", async function (assert) {
    await visit("/t/topic-for-group-moderators/2480");
    await selectText("#post_3 aside.onebox p");
    await click(".insert-quote");

    assert.strictEqual(
      query(".d-editor-input").value.trim(),
      '[quote="group_moderator, post:3, topic:2480"]\nhttps://example.com/57350945\n[/quote]',
      "quote only contains a link"
    );
  });
});

acceptance("Closed Topic - Quote button - logged in", function (needs) {
  needs.user();

  needs.pretender((server, helper) => {
    const topicResponse = cloneJSON(topicFixtures["/t/280/1.json"]);
    topicResponse.closed = true;
    topicResponse.details.can_create_post = false;

    server.get("/t/280.json", () => helper.response(topicResponse));
  });

  test("Shows quote button in closed topics", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_1 .cooked p:first-child");
    assert.ok(exists(".insert-quote"), "it shows the quote button");

    await click(".insert-quote");
    assert.ok(
      query(".d-editor-input")
        .value.trim()
        .startsWith("Continuing the discussion from"),
      "quote action defaults to reply as new topic (since topic is closed)"
    );
  });
});

acceptance("Topic - Quote button - anonymous", function (needs) {
  needs.settings({
    share_quote_visibility: "anonymous",
    share_quote_buttons: "twitter|email",
  });

  test("Shows quote share buttons with the right site settings", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 blockquote");

    assert.ok(queryAll(".quote-sharing"), "it shows the quote sharing options");
    assert.ok(
      exists(`.quote-sharing .btn[title='${I18n.t("share.twitter")}']`),
      "it includes the twitter share button"
    );
    assert.ok(
      exists(`.quote-sharing .btn[title='${I18n.t("share.email")}']`),
      "it includes the email share button"
    );
    assert.ok(!exists(".insert-quote"), "it does not show the quote button");
  });

  test("Shows single share button when site setting only has one item", async function (assert) {
    this.siteSettings.share_quote_buttons = "twitter";

    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 blockquote");

    assert.ok(exists(".quote-sharing"), "it shows the quote sharing options");
    assert.ok(
      exists(`.quote-sharing .btn[title='${I18n.t("share.twitter")}']`),
      "it includes the twitter share button"
    );
    assert.ok(
      !exists(".quote-share-label"),
      "it does not show the Share label"
    );
  });

  test("Shows nothing when visibility is disabled", async function (assert) {
    this.siteSettings.share_quote_visibility = "none";

    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 blockquote");

    assert.ok(!exists(".quote-sharing"), "it does not show quote sharing");
    assert.ok(!exists(".insert-quote"), "it does not show the quote button");
  });
});

acceptance("Topic - Quote button - keyboard shortcut", function (needs) {
  needs.user();

  test("Can use keyboard shortcut to quote selected text", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_1 .cooked");
    await triggerKeyEvent(document, "keypress", "Q");
    assert.ok(exists(".d-editor-input"), "the editor is open");

    assert.ok(
      query(".d-editor-input").value.includes("Any plans to support"),
      "editor includes selected text"
    );
  });
});
