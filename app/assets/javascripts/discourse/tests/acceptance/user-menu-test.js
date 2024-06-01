import { later } from "@ember/runloop";
import {
  click,
  currentRouteName,
  currentURL,
  triggerEvent,
  triggerKeyEvent,
  visit,
} from "@ember/test-helpers";
import { test } from "qunit";
import { Promise } from "rsvp";
import DButton from "discourse/components/d-button";
import { AUTO_GROUPS } from "discourse/lib/constants";
import { withPluginApi } from "discourse/lib/plugin-api";
import { NOTIFICATION_TYPES } from "discourse/tests/fixtures/concerns/notification-types";
import TopicFixtures from "discourse/tests/fixtures/topic";
import UserMenuFixtures from "discourse/tests/fixtures/user-menu";
import {
  acceptance,
  exists,
  loggedInUser,
  publishToMessageBus,
  query,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { cloneJSON } from "discourse-common/lib/object";
import I18n from "discourse-i18n";

acceptance("User menu", function (needs) {
  needs.user({
    unread_high_priority_notifications: 73,
    trust_level: 3,
    can_post_anonymously: true,
    grouped_unread_notifications: {
      [NOTIFICATION_TYPES.replied]: 2,
    },
  });

  needs.settings({
    allow_anonymous_posting: true,
  });

  let requestHeaders = {};

  needs.pretender((server, helper) => {
    server.get("/t/1234.json", (request) => {
      const json = cloneJSON(TopicFixtures["/t/130.json"]);
      json.id = 1234;
      json.post_stream.posts.forEach((post) => {
        post.topic_id = 1234;
      });
      requestHeaders = request.requestHeaders;
      return helper.response(json);
    });
  });

  needs.hooks.afterEach(() => {
    requestHeaders = {};
  });

  test("notifications panel has a11y attributes", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    const panel = query("#quick-access-all-notifications");
    assert.strictEqual(panel.getAttribute("tabindex"), "-1");
    assert.strictEqual(
      panel.querySelector("ul").getAttribute("aria-labelledby"),
      "user-menu-button-all-notifications"
    );
  });

  test("replies notifications panel has a11y attributes", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-replies");
    const panel = query("#quick-access-replies");
    assert.strictEqual(panel.getAttribute("tabindex"), "-1");
    assert.strictEqual(
      panel.querySelector("ul").getAttribute("aria-labelledby"),
      "user-menu-button-replies"
    );
  });

  test("profile panel has a11y attributes", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");
    const panel = query("#quick-access-profile");
    assert.strictEqual(panel.getAttribute("tabindex"), "-1");
    assert.strictEqual(
      panel.querySelector("ul").getAttribute("aria-labelledby"),
      "user-menu-button-profile"
    );
  });

  test("clicking on an unread notification", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    let repliesBadgeNotification = query(
      "#user-menu-button-replies .badge-notification"
    );
    assert.strictEqual(
      repliesBadgeNotification.textContent.trim(),
      "2",
      "badge shows the right count"
    );

    await click(".user-menu ul li.replied a");

    assert.strictEqual(
      requestHeaders["Discourse-Clear-Notifications"],
      123, // id is from the fixtures in fixtures/notification-fixtures.js
      "the Discourse-Clear-Notifications request header is set to the notification id in the next ajax request"
    );

    await click(".d-header-icons .current-user button");
    repliesBadgeNotification = query(
      "#user-menu-button-replies .badge-notification"
    );
    assert.strictEqual(
      repliesBadgeNotification.textContent.trim(),
      "1",
      "badge shows count reduced by one"
    );
  });

  test("clicking on user menu items", async function (assert) {
    updateCurrentUser({ reviewable_count: 1 });

    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-review-queue");

    assert.strictEqual(
      query(
        "#user-menu-button-review-queue .badge-notification"
      ).textContent.trim(),
      "8",
      "updates user's reviewable count based on request's response"
    );

    await click("#quick-access-review-queue li.reviewable.pending a");

    assert.strictEqual(
      currentURL(),
      "/review/17",
      "clicking on an item results in navigation to the item's page"
    );
    assert.notOk(
      exists(".user-menu"),
      "clicking on an item closes the menu after navigating"
    );

    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-review-queue");
    await click("#quick-access-review-queue li.reviewable.pending a");

    assert.strictEqual(
      currentURL(),
      "/review/17",
      "clicking on the same item again keeps on the same page"
    );
    assert.notOk(
      exists(".user-menu"),
      "clicking on the same item again closes the menu"
    );
  });

  test("tabs have title attributes", async function (assert) {
    updateCurrentUser({ reviewable_count: 1 });
    withPluginApi("0.1", (api) => {
      api.registerUserMenuTab((UserMenuTab) => {
        return class extends UserMenuTab {
          get id() {
            return "tiny-tab-1";
          }

          get count() {
            return this.currentUser.get("unread_high_priority_notifications");
          }

          get icon() {
            return "wrench";
          }

          get panelComponent() {
            return DButton;
          }

          get title() {
            return `Custom title: ${this.count}`;
          }
        };
      });
    });

    const expectedTitles = {
      "user-menu-button-all-notifications": I18n.t(
        "user_menu.tabs.all_notifications"
      ),
      "user-menu-button-replies": I18n.t("user_menu.tabs.replies_with_unread", {
        count: 2,
      }),
      "user-menu-button-likes": I18n.t("user_menu.tabs.likes"),
      "user-menu-button-messages": I18n.t("user_menu.tabs.messages"),
      "user-menu-button-bookmarks": I18n.t("user_menu.tabs.bookmarks"),
      "user-menu-button-tiny-tab-1": "Custom title: 73",
      "user-menu-button-review-queue": I18n.t(
        "user_menu.tabs.review_queue_with_unread",
        { count: 1 }
      ),
      "user-menu-button-other-notifications": I18n.t(
        "user_menu.tabs.other_notifications"
      ),
      "user-menu-button-profile": I18n.t("user_menu.tabs.profile"),
    };
    await visit("/");
    await click(".d-header-icons .current-user button");
    for (const [key, title] of Object.entries(expectedTitles)) {
      assert.strictEqual(
        query(`#${key}`).title,
        title,
        `${key} tab has the right title`
      );
    }

    await publishToMessageBus(`/notification/${loggedInUser().id}`, {
      unread_high_priority_notifications: 22,
    });
    assert.strictEqual(
      query("#user-menu-button-tiny-tab-1").title,
      "Custom title: 22",
      "tabs titles can update dynamically"
    );
  });

  test("tabs added via the plugin API", async function (assert) {
    updateCurrentUser({ reviewable_count: 1 });
    withPluginApi("0.1", (api) => {
      api.registerUserMenuTab((UserMenuTab) => {
        return class extends UserMenuTab {
          get id() {
            return "custom-tab-1";
          }

          get count() {
            return this.currentUser.get("unread_high_priority_notifications");
          }

          get icon() {
            return "wrench";
          }

          get panelComponent() {
            return DButton;
          }
        };
      });

      api.registerUserMenuTab((UserMenuTab) => {
        return class extends UserMenuTab {
          get id() {
            return "custom-tab-2";
          }

          get count() {
            return 29;
          }

          get icon() {
            return "plus";
          }

          get panelComponent() {
            return DButton;
          }
        };
      });
    });
    const expectedTabOrder = {
      "user-menu-button-all-notifications": "0",
      "user-menu-button-replies": "1",
      "user-menu-button-likes": "2",
      "user-menu-button-messages": "3",
      "user-menu-button-bookmarks": "4",
      "user-menu-button-custom-tab-1": "5",
      "user-menu-button-custom-tab-2": "6",
      "user-menu-button-review-queue": "7",
      "user-menu-button-other-notifications": "8",
    };

    await visit("/");
    await click(".d-header-icons .current-user button");

    assert.ok(
      exists("#user-menu-button-custom-tab-1"),
      "first custom tab is rendered"
    );
    assert.ok(
      exists("#user-menu-button-custom-tab-2"),
      "second custom tab is rendered"
    );

    const tabs = [...queryAll(".tabs-list.top-tabs .btn")];

    assert.deepEqual(
      tabs.reduce((acc, tab) => {
        acc[tab.id] = tab.dataset.tabNumber;
        return acc;
      }, {}),
      expectedTabOrder,
      "data-tab-number of the tabs has no gaps when custom tabs are added and the tabs are in the right order"
    );
    assert.strictEqual(
      query(".tabs-list.bottom-tabs .btn").dataset.tabNumber,
      "9",
      "bottom tab has the correct data-tab-number"
    );

    let customTab1Bubble = query(
      "#user-menu-button-custom-tab-1 .badge-notification"
    );

    assert.strictEqual(
      customTab1Bubble.textContent.trim(),
      "73",
      "bubble shows the right count"
    );

    const customTab2Bubble = query(
      "#user-menu-button-custom-tab-2 .badge-notification"
    );

    assert.strictEqual(
      customTab2Bubble.textContent.trim(),
      "29",
      "bubble shows the right count"
    );

    await publishToMessageBus(`/notification/${loggedInUser().id}`, {
      unread_high_priority_notifications: 18,
    });

    customTab1Bubble = query(
      "#user-menu-button-custom-tab-1 .badge-notification"
    );

    assert.strictEqual(
      customTab1Bubble.textContent.trim(),
      "18",
      "displayed bubble count updates when the value is changed"
    );

    await click("#user-menu-button-custom-tab-1");

    assert.ok(
      exists("#user-menu-button-custom-tab-1.active"),
      "custom tabs can be clicked on and become active"
    );

    assert.ok(
      exists("#quick-access-custom-tab-1 button.btn"),
      "the tab's content is now displayed in the panel"
    );
  });

  test("notifications tab applies model transformations registered by plugins", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.registerModelTransformer("notification", (notifications) => {
        notifications.forEach((notification, index) => {
          if (notification.fancy_title) {
            notification.fancy_title = `pluginNotificationTransformer ${index} ${notification.fancy_title}`;
          }
        });
      });
    });

    await visit("/");
    await click(".d-header-icons .current-user button");

    const notifications = queryAll(
      "#quick-access-all-notifications ul li.notification"
    );
    assert.strictEqual(
      notifications[0].textContent.replace(/\s+/g, " ").trim(),
      "velesin pluginNotificationTransformer 0 edited topic 443"
    );
    assert.strictEqual(
      notifications[1].textContent.replace(/\s+/g, " ").trim(),
      "velesin pluginNotificationTransformer 1 some title"
    );
  });

  test("bookmarks tab applies model transformations registered by plugins", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.registerModelTransformer("bookmark", (bookmarks) => {
        bookmarks.forEach((bookmark) => {
          if (bookmark.title) {
            bookmark.title = `pluginBookmarkTransformer ${bookmark.title}`;
          }
        });
      });
    });

    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-bookmarks");

    const bookmarks = queryAll("#quick-access-bookmarks ul li.bookmark");
    assert.strictEqual(
      bookmarks[0].textContent.replace(/\s+/g, " ").trim(),
      "osama pluginBookmarkTransformer Test poll topic hello world"
    );
  });

  test("messages tab applies model transformations registered by plugins", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.registerModelTransformer("topic", (topics) => {
        topics.forEach((topic) => {
          topic.fancy_title = `pluginTransformer#1 ${topic.fancy_title}`;
        });
      });
      api.registerModelTransformer("topic", async (topics) => {
        // sleep 1 ms
        await new Promise((resolve) => later(resolve, 1));
        topics.forEach((topic) => {
          topic.fancy_title = `pluginTransformer#2 ${topic.fancy_title}`;
        });
      });
    });

    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-messages");

    const messages = queryAll("#quick-access-messages ul li.message");
    assert.strictEqual(
      messages[0].textContent.replace(/\s+/g, " ").trim(),
      "mixtape pluginTransformer#2 pluginTransformer#1 BUG: Can not render emoji properly"
    );
  });

  test("the profile tab", async function (assert) {
    const clickOutside = () =>
      triggerEvent(document.querySelector("header.d-header"), "pointerdown");

    updateCurrentUser({ draft_count: 13 });
    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    const summaryLink = query("#quick-access-profile ul li.summary a");
    assert.ok(
      summaryLink.href.endsWith("/u/eviltrout/summary"),
      "has a link to the summary page of the user"
    );
    assert.strictEqual(
      summaryLink.textContent.trim(),
      I18n.t("user.summary.title"),
      "summary link has the right label"
    );
    assert.ok(
      summaryLink.querySelector(".d-icon-user"),
      "summary link has the right icon"
    );

    const activityLink = query("#quick-access-profile ul li.activity a");
    assert.ok(
      activityLink.href.endsWith("/u/eviltrout/activity"),
      "has a link to the activity page of the user"
    );
    assert.strictEqual(
      activityLink.textContent.trim(),
      I18n.t("user.activity_stream"),
      "activity link has the right label"
    );
    assert.ok(
      activityLink.querySelector(".d-icon-stream"),
      "activity link has the right icon"
    );

    const invitesLink = query("#quick-access-profile ul li.invites a");
    assert.ok(
      invitesLink.href.endsWith("/u/eviltrout/invited"),
      "has a link to the invites page of the user"
    );
    assert.strictEqual(
      invitesLink.textContent.trim(),
      I18n.t("user.invited.title"),
      "invites link has the right label"
    );
    assert.ok(
      invitesLink.querySelector(".d-icon-user-plus"),
      "invites link has the right icon"
    );

    await clickOutside();
    updateCurrentUser({ can_invite_to_forum: false });
    await click(".d-header-icons .current-user button");

    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.invites"),
      "invites link not shown when the user can't invite"
    );

    const draftsLink = query("#quick-access-profile ul li.drafts a");
    assert.ok(
      draftsLink.href.endsWith("/u/eviltrout/activity/drafts"),
      "has a link to the drafts page of the user"
    );
    assert.strictEqual(
      draftsLink.textContent.trim(),
      I18n.t("drafts.label_with_count", { count: 13 }),
      "drafts link has the right label with count of the user's drafts"
    );
    assert.ok(
      draftsLink.querySelector(".d-icon-user_menu\\.drafts"),
      "drafts link has the right icon"
    );

    const preferencesLink = query("#quick-access-profile ul li.preferences a");
    assert.ok(
      preferencesLink.href.endsWith("/u/eviltrout/preferences"),
      "has a link to the preferences page of the user"
    );
    assert.strictEqual(
      preferencesLink.textContent.trim(),
      I18n.t("user.preferences"),
      "preferences link has the right label"
    );
    assert.ok(
      preferencesLink.querySelector(".d-icon-cog"),
      "preferences link has the right icon"
    );

    let doNotDisturbButton = query(
      "#quick-access-profile ul li.do-not-disturb .btn"
    );
    assert.strictEqual(
      doNotDisturbButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("pause_notifications.label"),
      "Do Not Disturb button has the right label"
    );
    assert.ok(
      doNotDisturbButton.querySelector(".d-icon-toggle-off"),
      "Do Not Disturb button has the right icon"
    );

    await clickOutside();
    const date = new Date();
    date.setHours(date.getHours() + 2);
    updateCurrentUser({ do_not_disturb_until: date.toISOString() });
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    doNotDisturbButton = query(
      "#quick-access-profile ul li.do-not-disturb .btn"
    );
    assert.strictEqual(
      doNotDisturbButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      `${I18n.t("pause_notifications.label")} 2h`,
      "Do Not Disturb button has the right label when Do Not Disturb is enabled"
    );
    assert.ok(
      doNotDisturbButton.querySelector(".d-icon-toggle-on"),
      "Do Not Disturb button has the right icon when Do Not Disturb is enabled"
    );

    assert.ok(
      exists("#quick-access-profile ul li.enable-anonymous .btn"),
      "toggle anon button is shown"
    );
    let toggleAnonButton = query(
      "#quick-access-profile ul li.enable-anonymous .btn"
    );
    assert.strictEqual(
      toggleAnonButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("switch_to_anon"),
      "toggle anonymous button has the right label when the user isn't anonymous"
    );
    assert.ok(
      toggleAnonButton.querySelector(".d-icon-user-secret"),
      "toggle anonymous button has the right icon when the user isn't anonymous"
    );

    await clickOutside();
    updateCurrentUser({ is_anonymous: true });
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    toggleAnonButton = query(
      "#quick-access-profile ul li.disable-anonymous .btn"
    );
    assert.strictEqual(
      toggleAnonButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("switch_from_anon"),
      "toggle anonymous button has the right label when the user is anonymous"
    );
    assert.ok(
      toggleAnonButton.querySelector(".d-icon-ban"),
      "toggle anonymous button has the right icon when the user is anonymous"
    );

    await clickOutside();
    updateCurrentUser({
      is_anonymous: false,
      can_post_anonymously: false,
      trust_level: 2,
      groups: [
        AUTO_GROUPS.trust_level_0,
        AUTO_GROUPS.trust_level_1,
        AUTO_GROUPS.trust_level_2,
      ],
    });
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.enable-anonymous"),
      "toggle anon button isn't shown when the user can't use it"
    );
    assert.notOk(
      exists("#quick-access-profile ul li.disable-anonymous"),
      "toggle anon button isn't shown when the user can't use it"
    );

    await clickOutside();
    updateCurrentUser({
      is_anonymous: true,
      trust_level: 2,
      can_post_anonymously: true,
      groups: [
        AUTO_GROUPS.trust_level_0,
        AUTO_GROUPS.trust_level_1,
        AUTO_GROUPS.trust_level_2,
      ],
    });
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    assert.ok(
      exists("#quick-access-profile ul li.disable-anonymous"),
      "toggle anon button is always shown if the user is anonymous"
    );

    await clickOutside();
    updateCurrentUser({
      is_anonymous: true,
      can_post_anonymously: true,
      trust_level: 4,
      groups: [
        AUTO_GROUPS.trust_level_0,
        AUTO_GROUPS.trust_level_1,
        AUTO_GROUPS.trust_level_2,
        AUTO_GROUPS.trust_level_3,
        AUTO_GROUPS.trust_level_4,
      ],
    });
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.enable-anonymous"),
      "toggle anon button is not shown if the allow_anonymous_posting setting is false"
    );

    await clickOutside();
    updateCurrentUser({
      is_anonymous: false,
      can_post_anonymously: false,
      trust_level: 2,
      groups: [
        AUTO_GROUPS.trust_level_0,
        AUTO_GROUPS.trust_level_1,
        AUTO_GROUPS.trust_level_2,
      ],
    });
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.enable-anonymous"),
      "toggle anon button is not shown if the user is not allowed to post anonymously"
    );

    const logoutButton = query("#quick-access-profile ul li.logout .btn");
    assert.strictEqual(
      logoutButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("user.log_out"),
      "logout button has the right label"
    );
    assert.ok(
      logoutButton.querySelector(".d-icon-sign-out-alt"),
      "logout button has the right icon"
    );
  });

  test("Extra items added to profile tab via plugin API are rendered properly", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.addQuickAccessProfileItem({
        className: "test-1-item",
        icon: "wrench",
        content: "test 1",
        href: "/test_1_path",
      });

      api.addQuickAccessProfileItem({
        className: "test-2-item",
        content: "test 2",
        href: "/test_2_path",
      });
    });

    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");

    const item1 = query("#quick-access-profile ul li.test-1-item");

    assert.ok(
      item1.querySelector(".d-icon-wrench"),
      "The first item's icon is rendered"
    );
    assert.ok(
      item1.querySelector("a").href.endsWith("/test_1_path"),
      "The first item's link is present with correct href"
    );

    const item2 = query("#quick-access-profile ul li.test-2-item");

    assert.notOk(
      item2.querySelector(".d-icon"),
      "The second item doesn't have an icon"
    );
    assert.ok(
      item2.querySelector("a").href.endsWith("/test_2_path"),
      "The second item's link is present with correct href"
    );
  });

  test("the active tab can be clicked again to navigate to a page", async function (assert) {
    updateCurrentUser({ reviewable_count: 1 });
    withPluginApi("0.1", (api) => {
      api.registerUserMenuTab((UserMenuTab) => {
        return class extends UserMenuTab {
          get id() {
            return "custom-tab-1";
          }

          get icon() {
            return "wrench";
          }

          get panelComponent() {
            return DButton;
          }

          get linkWhenActive() {
            return "/u/eviltrout/preferences";
          }
        };
      });

      api.registerUserMenuTab((UserMenuTab) => {
        return class extends UserMenuTab {
          get id() {
            return "custom-tab-2";
          }

          get icon() {
            return "plus";
          }

          get panelComponent() {
            return DButton;
          }
        };
      });
    });
    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-all-notifications");
    assert.strictEqual(
      currentURL(),
      "/u/eviltrout/notifications",
      "clicking on active tab navigates to the page it links to"
    );
    assert.notOk(exists(".user-menu"), "user menu is closed after navigating");

    const tabs = [
      ["#user-menu-button-custom-tab-1", "/u/eviltrout/preferences/account"],
      ["#user-menu-button-replies", "/u/eviltrout/notifications/responses"],
      ["#user-menu-button-messages", "/u/eviltrout/messages"],
      ["#user-menu-button-bookmarks", "/u/eviltrout/activity/bookmarks"],
      ["#user-menu-button-likes", "/u/eviltrout/notifications/likes-received"],
      ["#user-menu-button-custom-tab-2", null],
      ["#user-menu-button-review-queue", "/review"],
      ["#user-menu-button-profile", "/u/eviltrout/summary"],
    ];
    for (const [id, expectedLink] of tabs) {
      await click(".d-header-icons .current-user button");
      await click(id);
      await click(id);
      if (expectedLink) {
        assert.strictEqual(
          currentURL(),
          expectedLink,
          `clicking on the ${id} tab navigates to ${expectedLink}`
        );
        assert.notOk(
          exists(".user-menu"),
          "user menu is closed after navigating"
        );
      } else {
        assert.ok(
          exists(".user-menu"),
          "user menu remains open if tab doesn't link to anywhere"
        );
      }
      await click("#site-logo");
    }
  });

  test("tabs have hrefs and can be opened in new window/tab", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    assert
      .dom("#user-menu-button-replies")
      .hasAttribute("href", "/u/eviltrout/notifications/responses");

    // Add a top-level click listener to stub attempts to open a new window/tab
    const newWindowOpenedAssertion = assert.async();
    const interceptor = (event) => {
      event.preventDefault();

      newWindowOpenedAssertion();
      const target = event.target;
      assert.strictEqual(target.tagName, "A");
      assert.true(target.href.endsWith("/u/eviltrout/notifications/responses"));
    };

    window.addEventListener("click", interceptor);

    try {
      await click("#user-menu-button-replies", { shiftKey: true });
    } finally {
      window.removeEventListener("click", interceptor);
    }
  });

  test("tabs without hrefs can be visited with the keyboard", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    await triggerKeyEvent(
      "#user-menu-button-other-notifications",
      "keydown",
      "Enter"
    );

    assert.ok(
      exists("#quick-access-other-notifications"),
      "the other notifications panel can display using keyboard navigation"
    );
  });

  test("closes the menu when navigating away", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-profile");
    await click(".quick-access-panel .preferences a");

    assert.dom(".user-menu").doesNotExist();
    assert.strictEqual(currentRouteName(), "preferences.account");
  });
});

acceptance("User menu - Dismiss button", function (needs) {
  needs.user({
    unread_high_priority_notifications: 10,
    grouped_unread_notifications: {
      [NOTIFICATION_TYPES.bookmark_reminder]: 103,
      [NOTIFICATION_TYPES.private_message]: 89,
      [NOTIFICATION_TYPES.votes_released]: 1,
      [NOTIFICATION_TYPES.code_review_commit_approved]: 3,
    },
  });

  let markRead = false;
  let markReadRequestBody;

  needs.pretender((server, helper) => {
    server.put("/notifications/mark-read", (request) => {
      markReadRequestBody = request.requestBody;
      markRead = true;
      return helper.response({ success: true });
    });

    server.get("/u/eviltrout/user-menu-bookmarks", () => {
      if (markRead) {
        const copy = cloneJSON(
          UserMenuFixtures["/u/:username/user-menu-bookmarks"]
        );
        copy.notifications = [];
        return helper.response(copy);
      } else {
        return helper.response(
          UserMenuFixtures["/u/:username/user-menu-bookmarks"]
        );
      }
    });

    server.get("/u/eviltrout/user-menu-private-messages", () => {
      if (markRead) {
        const copy = cloneJSON(
          UserMenuFixtures["/u/:username/user-menu-private-messages"]
        );
        copy.unread_notifications = [];
        return helper.response(copy);
      } else {
        return helper.response(
          UserMenuFixtures["/u/:username/user-menu-private-messages"]
        );
      }
    });
  });

  needs.hooks.afterEach(() => {
    markRead = false;
    markReadRequestBody = null;
  });

  test("shows confirmation modal for the all-notifications list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    await click(".user-menu .notifications-dismiss");
    assert.strictEqual(
      query(
        ".dismiss-notification-confirmation .d-modal__body"
      ).textContent.trim(),
      I18n.t("notifications.dismiss_confirmation.body.default", { count: 10 }),
      "confirmation modal is shown when there are unread high pri notifications"
    );

    await click(".d-modal__footer .btn-default"); // click cancel on the dismiss modal
    assert.notOk(markRead, "mark-read request isn't sent");

    await click(".user-menu .notifications-dismiss");
    await click(".d-modal__footer .btn-primary"); // click confirm on the dismiss modal
    assert.ok(markRead, "mark-read request is sent");
  });

  test("shows confirmation modal for the bookmarks list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    assert.strictEqual(
      query("#user-menu-button-bookmarks .badge-notification").textContent,
      "103",
      "bookmarks tab has bubble with count"
    );

    await click("#user-menu-button-bookmarks");
    assert.ok(
      exists("#quick-access-bookmarks ul li.notification"),
      "bookmark reminder notifications are visible"
    );
    assert.ok(
      exists("#quick-access-bookmarks ul li.bookmark"),
      "bookmarks are visible"
    );

    await click(".user-menu .notifications-dismiss");

    assert.strictEqual(
      query(
        ".dismiss-notification-confirmation .d-modal__body"
      ).textContent.trim(),
      I18n.t("notifications.dismiss_confirmation.body.bookmarks", {
        count: 103,
      }),
      "confirmation modal is shown when there are unread bookmark reminder notifications"
    );
    assert.notOk(markRead, "mark-read request isn't sent");

    await click(".d-modal__footer .btn-primary"); // confirm dismiss on the dismiss modal

    assert.notOk(
      exists("#quick-access-bookmarks ul li.notification"),
      "bookmark reminder notifications are gone"
    );
    assert.ok(
      exists("#quick-access-bookmarks ul li.bookmark"),
      "bookmarks are still visible"
    );
    assert.notOk(
      exists("#user-menu-button-bookmarks .badge-notification"),
      "bookmarks tab no longer has bubble"
    );
    assert.ok(markRead, "mark-read request is sent");
    assert.strictEqual(
      markReadRequestBody,
      "dismiss_types=bookmark_reminder",
      "mark-read request specifies bookmark_reminder types"
    );
    assert.notOk(exists(".user-menu .notifications-dismiss"));
  });

  test("shows confirmation modal for the messages list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    assert.strictEqual(
      query("#user-menu-button-messages .badge-notification").textContent,
      "89",
      "messages tab has bubble with count"
    );

    await click("#user-menu-button-messages");
    assert.ok(
      exists("#quick-access-messages ul li.notification"),
      "messages notifications are visible"
    );
    assert.ok(
      exists("#quick-access-messages ul li.message"),
      "messages are visible"
    );

    await click(".user-menu .notifications-dismiss");

    assert.strictEqual(
      query(
        ".dismiss-notification-confirmation .d-modal__body"
      ).textContent.trim(),
      I18n.t("notifications.dismiss_confirmation.body.messages", {
        count: 89,
      }),
      "confirmation modal is shown when there are unread messages notifications"
    );
    assert.notOk(markRead, "mark-read request isn't sent");

    await click(".d-modal__footer .btn-primary"); // confirm dismiss on the dismiss modal

    assert.notOk(
      exists("#quick-access-messages ul li.notification"),
      "messages notifications are gone"
    );
    assert.ok(
      exists("#quick-access-messages ul li.message"),
      "messages are still visible"
    );
    assert.notOk(
      exists("#user-menu-button-messages .badge-notification"),
      "messages tab no longer has bubble"
    );
    assert.ok(markRead, "mark-read request is sent");
    assert.strictEqual(
      markReadRequestBody,
      "dismiss_types=private_message%2Cgroup_message_summary",
      "mark-read request specifies private_message types"
    );
    assert.notOk(exists(".user-menu .notifications-dismiss"));
  });

  test("doesn't show confirmation modal for the likes notifications list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    await click("#user-menu-button-likes");
    await click(".user-menu .notifications-dismiss");
    assert.ok(
      markRead,
      "mark-read request is sent without a confirmation modal"
    );
  });

  test("doesn't show confirmation modal for the other notifications list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");

    await click("#user-menu-button-other-notifications");
    let othersBadgeNotification = query(
      "#user-menu-button-other-notifications .badge-notification"
    );
    assert.strictEqual(
      othersBadgeNotification.textContent.trim(),
      "4",
      "badge shows the right count"
    );

    await click(".user-menu .notifications-dismiss");

    assert.ok(
      !exists("#user-menu-button-other-notifications .badge-notification")
    );
    assert.ok(
      markRead,
      "mark-read request is sent without a confirmation modal"
    );
  });
});

acceptance("User menu - avatars", function (needs) {
  needs.user();

  needs.settings({
    show_user_menu_avatars: true,
  });

  test("It shows user avatars for various notifications on all notifications pane", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    assert.ok(exists("li.notification.edited .icon-avatar"));
    assert.ok(exists("li.notification.replied .icon-avatar"));
  });

  test("It shows user avatars for messages", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-messages");

    assert.ok(exists("li.notification.private-message .icon-avatar"));
    assert.ok(exists("li.message .icon-avatar"));
  });

  test("It shows user avatars for bookmark items and bookmark reminder notification items", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    await click("#user-menu-button-bookmarks");

    assert.ok(exists("li.notification.bookmark-reminder .icon-avatar"));
    assert.ok(exists("li.bookmark .icon-avatar"));
  });

  test("Icon avatars have correct class names based on system avatar usage", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user button");
    assert.ok(exists("li.group-message-summary .icon-avatar.system-avatar"));
    assert.ok(exists("li.notification.replied .icon-avatar.user-avatar"));
  });
});
