import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import topicFixtures from "discourse/tests/fixtures/topic";
import {
  acceptance,
  fakeTime,
  loggedInUser,
  query,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { cloneJSON } from "discourse-common/lib/object";
import I18n from "discourse-i18n";

acceptance("Topic - Edit timer", function (needs) {
  let clock = null;
  needs.user();
  needs.pretender((server, helper) => {
    server.post("/t/280/timer", () =>
      helper.response({
        success: "OK",
        execute_at: new Date(
          new Date().getTime() + 1 * 60 * 60 * 1000
        ).toISOString(),
        duration_minutes: 1440,
        based_on_last_post: false,
        closed: false,
        category_id: null,
      })
    );

    const topicResponse = cloneJSON(topicFixtures["/t/54077.json"]);
    topicResponse.details.can_delete = false;
    server.get("/t/54077.json", () => helper.response(topicResponse));
  });

  needs.hooks.beforeEach(() => {
    const timezone = loggedInUser().user_option.timezone;
    const tuesday = "2100-06-15T08:00:00";
    clock = fakeTime(tuesday, timezone, true);
  });

  needs.hooks.afterEach(() => {
    clock.restore();
  });

  test("autoclose - specific time", async function (assert) {
    updateCurrentUser({ moderator: true });
    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await click("#tap_tile_start_of_next_business_week");

    assert
      .dom(".edit-topic-timer-modal .topic-timer-info")
      .matchesText(/will automatically close in/g);
  });

  test("autoclose", async function (assert) {
    updateCurrentUser({ moderator: true });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await click("#tap_tile_start_of_next_business_week");

    assert
      .dom(".edit-topic-timer-modal .topic-timer-info")
      .matchesText(/will automatically close in/g);

    await click("#tap_tile_custom");
    await fillIn(".tap-tile-date-input .date-picker", "2100-11-24");

    assert
      .dom(".edit-topic-timer-modal .topic-timer-info")
      .matchesText(/will automatically close in/g);

    const timerType = selectKit(".select-kit.timer-type");
    await timerType.expand();
    await timerType.selectRowByValue("close_after_last_post");

    const interval = selectKit(".select-kit.relative-time-intervals");
    await interval.expand();
    await interval.selectRowByValue("hours");
    await fillIn(".relative-time-duration", "2");

    assert
      .dom(".edit-topic-timer-modal .warning")
      .matchesText(/last post in the topic is already/g);
  });

  test("close temporarily", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await timerType.expand();
    await timerType.selectRowByValue("open");

    await click("#tap_tile_start_of_next_business_week");

    assert
      .dom(".edit-topic-timer-modal .topic-timer-info")
      .matchesText(/will automatically open in/g);

    await click("#tap_tile_custom");
    await fillIn(".tap-tile-date-input .date-picker", "2100-11-24");

    assert
      .dom(".edit-topic-timer-modal .topic-timer-info")
      .matchesText(/will automatically open in/g);
  });

  test("schedule publish to category - visible for a PM", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");
    const categoryChooser = selectKit(".d-modal__body .category-chooser");

    await visit("/t/pm-for-testing/12");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await timerType.expand();
    await timerType.selectRowByValue("publish_to_category");

    assert.strictEqual(categoryChooser.header().label(), "category…");
    assert.strictEqual(categoryChooser.header().value(), null);

    await categoryChooser.expand();
    await categoryChooser.selectRowByValue("7");

    await click("#tap_tile_start_of_next_business_week");

    const text = query(
      ".edit-topic-timer-modal .topic-timer-info"
    ).innerText.trim();

    // this needs to be done because there is no simple way to get the
    // plain text version of a translation with HTML
    let el = document.createElement("p");
    el.innerHTML = I18n.t(
      "topic.status_update_notice.auto_publish_to_category",
      {
        categoryUrl: "/c/dev/7",
        categoryName: "dev",
        timeLeft: "in 6 days",
      }
    );

    assert.strictEqual(text, el.innerText);
  });

  test("schedule publish to category - visible for a private category", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");
    const categoryChooser = selectKit(".d-modal__body .category-chooser");

    // has private category id 24 (shared drafts)
    await visit("/t/some-topic/9");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await timerType.expand();
    await timerType.selectRowByValue("publish_to_category");

    assert.strictEqual(categoryChooser.header().label(), "category…");
    assert.strictEqual(categoryChooser.header().value(), null);

    await categoryChooser.expand();
    await categoryChooser.selectRowByValue("7");

    await click("#tap_tile_start_of_next_business_week");

    const text = query(
      ".edit-topic-timer-modal .topic-timer-info"
    ).innerText.trim();

    // this needs to be done because there is no simple way to get the
    // plain text version of a translation with HTML
    let el = document.createElement("p");
    el.innerHTML = I18n.t(
      "topic.status_update_notice.auto_publish_to_category",
      {
        categoryUrl: "/c/dev/7",
        categoryName: "dev",
        timeLeft: "in 6 days",
      }
    );

    assert.strictEqual(text, el.innerText);
  });

  test("schedule publish to category - visible for an unlisted public topic", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");
    const categoryChooser = selectKit(".d-modal__body .category-chooser");

    await visit("/t/internationalization-localization/280");

    // make topic not visible
    await click(".toggle-admin-menu");
    await click(".topic-admin-visible .btn");

    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await timerType.expand();
    await timerType.selectRowByValue("publish_to_category");

    assert.strictEqual(categoryChooser.header().label(), "category…");
    assert.strictEqual(categoryChooser.header().value(), null);

    await categoryChooser.expand();
    await categoryChooser.selectRowByValue("7");

    await click("#tap_tile_start_of_next_business_week");

    const text = query(
      ".edit-topic-timer-modal .topic-timer-info"
    ).innerText.trim();

    // this needs to be done because there is no simple way to get the
    // plain text version of a translation with HTML
    let el = document.createElement("p");
    el.innerHTML = I18n.t(
      "topic.status_update_notice.auto_publish_to_category",
      {
        categoryUrl: "/c/dev/7",
        categoryName: "dev",
        timeLeft: "in 6 days",
      }
    );

    assert.strictEqual(text, el.innerText);
  });

  test("schedule publish to category - last custom date and time", async function (assert) {
    updateCurrentUser({ moderator: true });
    await visit("/t/internationalization-localization");

    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");
    assert
      .dom("#tap_tile_last_custom")
      .doesNotExist(
        "it does not show last custom if the custom date and time was not filled before"
      );

    await click(".modal-close");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");
    await click("#tap_tile_custom");
    await fillIn(".tap-tile-date-input .date-picker", "2100-11-24");
    await fillIn("#custom-time", "10:30");
    await click(".edit-topic-timer-modal button.btn-primary");

    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    assert
      .dom("#tap_tile_last_custom")
      .exists("it show last custom because the custom date and time was valid");

    assert.dom("#tap_tile_last_custom").matchesText(/Nov 24, 10:30 am/g);
  });

  test("schedule publish to category - does not show for a public topic", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await timerType.expand();
    assert.false(
      timerType.rowByValue("publish_to_category").exists(),
      "publish to category is not shown for a public topic"
    );
  });

  test("TL4 can't auto-delete", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false, trust_level: 4 });

    await visit("/t/short-topic-with-two-posts/54077");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    const timerType = selectKit(".select-kit.timer-type");

    await timerType.expand();

    assert.false(timerType.rowByValue("delete").exists());
  });

  test("Category Moderator can auto-delete replies", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false, trust_level: 4 });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    const timerType = selectKit(".select-kit.timer-type");

    await timerType.expand();

    assert.true(timerType.rowByValue("delete_replies").exists());
  });

  test("TL4 can't auto-delete replies", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false, trust_level: 4 });

    await visit("/t/short-topic-with-two-posts/54077");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    const timerType = selectKit(".select-kit.timer-type");

    await timerType.expand();

    assert.false(timerType.rowByValue("delete_replies").exists());
  });

  test("Category Moderator can auto-delete", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false, trust_level: 4 });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    const timerType = selectKit(".select-kit.timer-type");

    await timerType.expand();

    assert.true(timerType.rowByValue("delete").exists());
  });

  test("auto delete", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    await timerType.expand();
    await timerType.selectRowByValue("delete");

    await click("#tap_tile_two_weeks");

    assert
      .dom(".edit-topic-timer-modal .topic-timer-info")
      .matchesText(/will be automatically deleted/g);
  });

  test("Inline delete timer", async function (assert) {
    updateCurrentUser({ moderator: true });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");
    await click("#tap_tile_start_of_next_business_week");
    await click(".edit-topic-timer-modal button.btn-primary");

    assert
      .dom(".topic-timer-info .topic-timer-remove")
      .hasAttribute("title", "remove timer");

    await click(".topic-timer-info .topic-timer-remove");
    assert.dom(".topic-timer-info .topic-timer-remove").doesNotExist();
  });

  test("Shows correct time frame options", async function (assert) {
    this.siteSettings.suggest_weekends_in_date_pickers = true;
    updateCurrentUser({ moderator: true });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    assert.deepEqual(
      [...queryAll("div.tap-tile-grid div.tap-tile-title")].map((el) =>
        el.innerText.trim()
      ),
      [
        I18n.t("time_shortcut.tomorrow"),
        I18n.t("time_shortcut.this_weekend"),
        I18n.t("time_shortcut.start_of_next_business_week"),
        I18n.t("time_shortcut.two_weeks"),
        I18n.t("time_shortcut.next_month"),
        I18n.t("time_shortcut.six_months"),
        I18n.t("time_shortcut.custom"),
      ]
    );
  });

  test("Does not show timer notice unless timer set", async function (assert) {
    updateCurrentUser({ moderator: true });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");

    const timerType = selectKit(".select-kit.timer-type");
    await timerType.expand();
    await timerType.selectRowByValue("close_after_last_post");

    assert.dom(".topic-timer-heading").doesNotExist();
  });

  test("Close timer removed after manual close", async function (assert) {
    updateCurrentUser({ moderator: true, trust_level: 4 });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");
    await click("#tap_tile_tomorrow");
    await click(".edit-topic-timer-modal button.btn-primary");

    await click(".toggle-admin-menu");
    await click(".topic-admin-close button");

    assert.dom(".topic-timer-heading").doesNotExist();
  });

  test("Open timer removed after manual open", async function (assert) {
    updateCurrentUser({ moderator: true, trust_level: 4 });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-close button");

    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");
    await click("#tap_tile_tomorrow");
    await click(".edit-topic-timer-modal button.btn-primary");

    await click(".toggle-admin-menu");
    await click(".topic-admin-open button");

    assert.dom(".topic-timer-heading").doesNotExist();
  });

  test("timer removed after manual toggle close and open", async function (assert) {
    updateCurrentUser({ moderator: true, trust_level: 4 });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".admin-topic-timer-update button");
    await click("#tap_tile_tomorrow");
    await click(".edit-topic-timer-modal button.btn-primary");

    await click(".toggle-admin-menu");
    await click(".topic-admin-close button");

    await click(".toggle-admin-menu");
    await click(".topic-admin-open button");

    assert.dom(".topic-timer-heading").doesNotExist();
  });
});
