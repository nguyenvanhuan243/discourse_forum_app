import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  count,
  exists,
  fakeTime,
  loggedInUser,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import I18n from "discourse-i18n";

acceptance("User notification schedule", function (needs) {
  needs.user();

  test("the schedule interface is hidden until enabled", async function (assert) {
    await visit("/u/eviltrout/preferences/notifications");

    assert.ok(
      !exists(".notification-schedule-table"),
      "notification schedule is hidden"
    );
    await click(".control-group.notification-schedule input");
    assert.ok(
      exists(".notification-schedule-table"),
      "notification schedule is visible"
    );
  });

  test("By default every day is selected 8:00am - 5:00pm", async function (assert) {
    await visit("/u/eviltrout/preferences/notifications");
    await click(".control-group.notification-schedule input");

    [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ].forEach((day) => {
      assert.strictEqual(
        selectKit(`.day.${day} .starts-at .combobox`).header().label(),
        "8:00 AM",
        "8am is selected"
      );
      assert.strictEqual(
        selectKit(`.day.${day} .starts-at .combobox`).header().value(),
        "480",
        "8am is 480"
      );
      assert.strictEqual(
        selectKit(`.day.${day} .ends-at .combobox`).header().label(),
        "5:00 PM",
        "5am is selected"
      );
      assert.strictEqual(
        selectKit(`.day.${day} .ends-at .combobox`).header().value(),
        "1020",
        "5pm is 1020"
      );
    });
  });

  test("If 'none' is selected for the start time, end time dropdown is removed", async function (assert) {
    await visit("/u/eviltrout/preferences/notifications");
    await click(".control-group.notification-schedule input");

    await selectKit(".day.Monday .combobox").expand();
    await selectKit(".day.Monday .combobox").selectRowByValue(-1);

    assert.strictEqual(
      selectKit(".day.Monday .starts-at .combobox").header().value(),
      "-1",
      "set monday input to none"
    );
    assert.strictEqual(
      selectKit(".day.Monday .starts-at .combobox").header().label(),
      "None",
      "set monday label to none"
    );
    assert.strictEqual(
      count(".day.Monday .select-kit.single-select"),
      1,
      "The end time input is hidden"
    );
  });

  test("If start time is after end time, end time gets bumped 30 minutes past start time", async function (assert) {
    await visit("/u/eviltrout/preferences/notifications");
    await click(".control-group.notification-schedule input");

    await selectKit(".day.Tuesday .starts-at .combobox").expand();
    await selectKit(".day.Tuesday .starts-at .combobox").selectRowByValue(
      "1350"
    );

    assert.strictEqual(
      selectKit(".day.Tuesday .ends-at .combobox").header().value(),
      "1380",
      "End time is 30 past start time"
    );

    await selectKit(".day.Tuesday .ends-at .combobox").expand();
    assert.ok(
      !selectKit(".day.Tuesday .ends-at .combobox").rowByValue(1350).exists(),
      "End time options are limited to + 30 past start time"
    );
  });
});

acceptance("User Notifications - Users - Ignore User", function (needs) {
  let clock = null;
  needs.user();

  needs.hooks.beforeEach(() => {
    const timezone = loggedInUser().user_option.timezone;
    clock = fakeTime("2100-05-03T08:00:00", timezone, true); // Monday morning
  });

  needs.hooks.afterEach(() => {
    clock.restore();
  });

  test("Shows correct timeframe options", async function (assert) {
    this.siteSettings.suggest_weekends_in_date_pickers = true;
    await visit("/u/eviltrout/preferences/users");

    await click("div.user-notifications div div button");
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
      I18n.t("time_shortcut.this_weekend"),
      I18n.t("time_shortcut.start_of_next_business_week_alt"),
      I18n.t("time_shortcut.two_weeks"),
      I18n.t("time_shortcut.next_month"),
      I18n.t("time_shortcut.two_months"),
      I18n.t("time_shortcut.three_months"),
      I18n.t("time_shortcut.four_months"),
      I18n.t("time_shortcut.six_months"),
      I18n.t("time_shortcut.one_year"),
      I18n.t("time_shortcut.forever"),
    ];

    assert.deepEqual(options, expected, "options are correct");
  });
});
