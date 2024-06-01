import { click } from "@ember/test-helpers";
import { test } from "qunit";
import { AUTO_GROUPS } from "discourse/lib/constants";
import {
  acceptance,
  exists,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";
import { displayPollBuilderButton } from "discourse/plugins/poll/helpers/display-poll-builder-button";

acceptance("Poll Builder - polls are enabled", function (needs) {
  needs.user();
  needs.settings({
    poll_enabled: true,
    poll_create_allowed_groups: AUTO_GROUPS.trust_level_1,
  });

  test("regular user - sufficient trust level", async function (assert) {
    updateCurrentUser({
      moderator: false,
      admin: false,
      trust_level: 1,
      can_create_poll: true,
    });

    await displayPollBuilderButton();

    const pollBuilderButtonSelector = `.select-kit-row[data-name='${I18n.t(
      "poll.ui_builder.title"
    )}']`;

    assert.dom(pollBuilderButtonSelector).exists("it shows the builder button");

    await click(pollBuilderButtonSelector);

    assert.true(
      exists(".poll-type-value-regular.active"),
      "regular type is active"
    );

    await click(".poll-type-value-multiple");

    assert.true(
      exists(".poll-type-value-multiple.active"),
      "multiple type is active"
    );

    await click(".poll-type-value-regular");

    assert.true(
      exists(".poll-type-value-regular.active"),
      "regular type is active"
    );
  });

  test("regular user - insufficient trust level", async function (assert) {
    updateCurrentUser({
      moderator: false,
      admin: false,
      trust_level: 0,
      can_create_poll: false,
    });

    await displayPollBuilderButton();

    assert.ok(
      !exists(".select-kit-row[data-value='showPollBuilder]"),
      "it hides the builder button"
    );
  });

  test("staff - with insufficient trust level", async function (assert) {
    updateCurrentUser({ moderator: true, trust_level: 0 });

    await displayPollBuilderButton();

    assert
      .dom(`.select-kit-row[data-name='${I18n.t("poll.ui_builder.title")}']`)
      .exists("it shows the builder button");
  });
});
