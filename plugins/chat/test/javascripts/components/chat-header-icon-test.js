import { render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import sinon from "sinon";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import I18n from "discourse-i18n";
import { HEADER_INDICATOR_PREFERENCE_ALL_NEW } from "discourse/plugins/chat/discourse/controllers/preferences-chat";

module("Discourse Chat | Component | chat-header-icon", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {});

  test("full page - never separated sidebar mode", async function (assert) {
    this.currentUser.user_option.chat_separate_sidebar_mode = "never";
    sinon
      .stub(this.owner.lookup("service:chat-state-manager"), "isFullPageActive")
      .value(true);

    await render(hbs`<Chat::Header::Icon />`);

    assert
      .dom(".icon.btn-flat")
      .hasAttribute("title", I18n.t("chat.title_capitalized"))
      .hasAttribute("href", "/chat");

    assert.dom(".d-icon-d-chat").exists();
  });

  test("full page - always separated mode", async function (assert) {
    this.currentUser.user_option.chat_separate_sidebar_mode = "always";
    sinon
      .stub(this.owner.lookup("service:chat-state-manager"), "isFullPageActive")
      .value(true);

    await render(hbs`<Chat::Header::Icon />`);

    assert
      .dom(".icon.btn-flat")
      .hasAttribute("title", I18n.t("sidebar.panels.forum.label"))
      .hasAttribute("href", "/latest");

    assert.dom(".d-icon-random").exists();
  });

  test("mobile", async function (assert) {
    this.site.mobileView = true;

    await render(hbs`<Chat::Header::Icon />`);

    assert
      .dom(".icon.btn-flat")
      .hasAttribute("title", I18n.t("chat.title_capitalized"))
      .hasAttribute("href", "/chat");

    assert.dom(".d-icon-d-chat").exists();
  });

  test("full page - with unread", async function (assert) {
    this.currentUser.user_option.chat_separate_sidebar_mode = "always";
    this.currentUser.user_option.chat_header_indicator_preference =
      HEADER_INDICATOR_PREFERENCE_ALL_NEW;

    sinon
      .stub(this.owner.lookup("service:chat-state-manager"), "isFullPageActive")
      .value(true);

    await render(hbs`<Chat::Header::Icon @urgentCount={{1}} />`);

    assert
      .dom(".icon.btn-flat")
      .hasAttribute("title", I18n.t("sidebar.panels.forum.label"))
      .hasAttribute("href", "/latest");
    assert.dom(".d-icon-random").exists();
    assert.dom(".chat-channel-unread-indicator__number").doesNotExist();
  });

  test("drawer - with unread", async function (assert) {
    this.currentUser.user_option.chat_separate_sidebar_mode = "always";
    this.currentUser.user_option.chat_header_indicator_preference =
      HEADER_INDICATOR_PREFERENCE_ALL_NEW;

    await render(hbs`<Chat::Header::Icon @urgentCount={{1}} />`);

    assert
      .dom(".icon.btn-flat")
      .hasAttribute("title", I18n.t("sidebar.panels.chat.label"))
      .hasAttribute("href", "/chat");
    assert.dom(".d-icon-d-chat").exists();
    assert
      .dom(".chat-channel-unread-indicator__number")
      .exists()
      .containsText("1");
  });
});
