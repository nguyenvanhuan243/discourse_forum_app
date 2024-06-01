import { click, render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import {
  exists,
  fakeTime,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

module("Integration | Component | time-shortcut-picker", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    const itsatrapStub = {
      bind: () => {},
      unbind: () => {},
    };

    this.set("itsatrap", itsatrapStub);
  });

  hooks.afterEach(function () {
    this.clock?.restore();
  });

  test("shows default options", async function (assert) {
    this.siteSettings.suggest_weekends_in_date_pickers = true;
    const tuesday = "2100-06-08T08:00:00";
    this.clock = fakeTime(tuesday, this.currentUser.user_option.timezone, true);

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    const expected = [
      I18n.t("time_shortcut.later_today"),
      I18n.t("time_shortcut.tomorrow"),
      I18n.t("time_shortcut.later_this_week"),
      I18n.t("time_shortcut.this_weekend"),
      I18n.t("time_shortcut.start_of_next_business_week"),
      I18n.t("time_shortcut.next_month"),
      I18n.t("time_shortcut.custom"),
      I18n.t("time_shortcut.none"),
    ];

    const options = Array.from(
      queryAll("div.tap-tile-grid div.tap-tile-title").map((_, div) =>
        div.innerText.trim()
      )
    );

    assert.deepEqual(options, expected);
  });

  test("show 'Later This Week' if today is < Thursday", async function (assert) {
    const monday = "2100-06-07T08:00:00";
    this.clock = fakeTime(monday, this.currentUser.user_option.timezone, true);

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.ok(exists("#tap_tile_later_this_week"), "it has later this week");
  });

  test("does not show 'Later This Week' if today is >= Thursday", async function (assert) {
    const thursday = "2100-06-10T08:00:00";
    this.clock = fakeTime(
      thursday,
      this.currentUser.user_option.timezone,
      true
    );

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.notOk(
      exists("#tap_tile_later_this_week"),
      "it does not have later this week"
    );
  });

  test("does not show 'Later Today' if 'Later Today' is tomorrow", async function (assert) {
    this.clock = fakeTime(
      "2100-12-11T22:00:00", // + 3 hours is tomorrow
      this.currentUser.user_option.timezone,
      true
    );

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.notOk(
      exists("#tap_tile_later_today"),
      "it does not have later today"
    );
  });

  test("shows 'Later Today' if it is before 5pm", async function (assert) {
    this.clock = fakeTime(
      "2100-12-11T16:50:00",
      this.currentUser.user_option.timezone,
      true
    );

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.ok(exists("#tap_tile_later_today"), "it does have later today");
  });

  test("does not show 'Later Today' if it is after 5pm", async function (assert) {
    this.clock = fakeTime(
      "2100-12-11T17:00:00",
      this.currentUser.user_option.timezone,
      true
    );

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.notOk(
      exists("#tap_tile_later_today"),
      "it does not have later today"
    );
  });

  test("default custom date time is in one hour from now", async function (assert) {
    this.clock = fakeTime(
      "2100-12-11T17:00:00",
      this.currentUser.user_option.timezone,
      true
    );

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    await click("#tap_tile_custom");
    assert.strictEqual(query("#custom-date > input").value, "2100-12-11");
    assert.strictEqual(query("#custom-time").value, "18:00");
  });

  test("shows 'Next Monday' instead of 'Monday' on Sundays", async function (assert) {
    const sunday = "2100-01-24T08:00:00";
    this.clock = fakeTime(sunday, this.currentUser.user_option.timezone, true);

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.strictEqual(
      query("#tap_tile_start_of_next_business_week .tap-tile-title").innerText,
      "Next Monday"
    );

    assert.strictEqual(
      query("div#tap_tile_start_of_next_business_week div.tap-tile-date")
        .innerText,
      "Feb 1, 8:00 am"
    );
  });

  test("shows 'Next Monday' instead of 'Monday' on Mondays", async function (assert) {
    const monday = "2100-01-25T08:00:00";
    this.clock = fakeTime(monday, this.currentUser.user_option.timezone, true);

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.strictEqual(
      query("#tap_tile_start_of_next_business_week .tap-tile-title").innerText,
      "Next Monday"
    );

    assert.strictEqual(
      query("div#tap_tile_start_of_next_business_week div.tap-tile-date")
        .innerText,
      "Feb 1, 8:00 am"
    );
  });

  test("the 'Next Month' option points to the first day of the next month", async function (assert) {
    this.clock = fakeTime(
      "2100-01-01T08:00:00",
      this.currentUser.user_option.timezone,
      true
    );

    await render(hbs`<TimeShortcutPicker @_itsatrap={{this.itsatrap}} />`);

    assert.strictEqual(
      query("div#tap_tile_next_month div.tap-tile-date").innerText,
      "Feb 1, 8:00 am"
    );
  });
});
