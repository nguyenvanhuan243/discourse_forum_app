import { render, settled } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { withPluginApi } from "discourse/lib/plugin-api";
import UserMenuBookmarkItem from "discourse/lib/user-menu/bookmark-item";
import UserMenuMessageItem from "discourse/lib/user-menu/message-item";
import UserMenuNotificationItem from "discourse/lib/user-menu/notification-item";
import UserMenuReviewableItem from "discourse/lib/user-menu/reviewable-item";
import Notification from "discourse/models/notification";
import UserMenuReviewable from "discourse/models/user-menu-reviewable";
import { NOTIFICATION_TYPES } from "discourse/tests/fixtures/concerns/notification-types";
import PrivateMessagesFixture from "discourse/tests/fixtures/private-messages-fixtures";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { exists, query } from "discourse/tests/helpers/qunit-helpers";
import { cloneJSON, deepMerge } from "discourse-common/lib/object";
import I18n from "discourse-i18n";

function getNotification(currentUser, siteSettings, site, overrides = {}) {
  const notification = Notification.create(
    deepMerge(
      {
        id: 11,
        user_id: 1,
        notification_type: NOTIFICATION_TYPES.mentioned,
        read: false,
        high_priority: false,
        created_at: "2022-07-01T06:00:32.173Z",
        post_number: 113,
        topic_id: 449,
        fancy_title: "This is fancy title &lt;a&gt;!",
        slug: "this-is-fancy-title",
        data: {
          topic_title: "this is title before it becomes fancy <a>!",
          display_username: "osama",
          original_post_id: 1,
          original_post_type: 1,
          original_username: "velesin",
        },
      },
      overrides
    )
  );
  return new UserMenuNotificationItem({
    notification,
    currentUser,
    siteSettings,
    site,
  });
}

module(
  "Integration | Component | user-menu | menu-item | with notification items",
  function (hooks) {
    setupRenderingTest(hooks);

    const template = hbs`<UserMenu::MenuItem @item={{this.item}}/>`;

    test("pushes `read` to the classList if the notification is read and `unread` if it isn't", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site)
      );
      this.item.notification.read = false;
      await render(template);
      assert.notOk(exists("li.read"));
      assert.ok(exists("li.unread"));

      this.item.notification.read = true;
      await settled();

      assert.ok(
        exists("li.read"),
        "the item re-renders when the read property is updated"
      );
      assert.notOk(
        exists("li.unread"),
        "the item re-renders when the read property is updated"
      );
    });

    test("pushes the notification type name to the classList", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site)
      );
      await render(template);
      let item = query("li");
      assert.ok(item.classList.contains("mentioned"));

      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          notification_type: NOTIFICATION_TYPES.private_message,
        })
      );
      await settled();

      assert.ok(
        exists("li.private-message"),
        "replaces underscores in type name with dashes"
      );
    });

    test("pushes is-warning to the classList if the notification originates from a warning PM", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          is_warning: true,
        })
      );
      await render(template);
      assert.ok(exists("li.is-warning"));
    });

    test("doesn't push is-warning to the classList if the notification doesn't originate from a warning PM", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site)
      );
      await render(template);
      assert.ok(!exists("li.is-warning"));
      assert.ok(exists("li"));
    });

    test("the item's href links to the topic that the notification originates from", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site)
      );
      await render(template);
      const link = query("li a");
      assert.ok(link.href.endsWith("/t/this-is-fancy-title/449/113"));
    });

    test("the item's href links to the group messages if the notification is for a group messages", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          topic_id: null,
          post_number: null,
          slug: null,
          data: {
            group_id: 33,
            group_name: "grouperss",
            username: "ossaama",
          },
        })
      );
      await render(template);
      const link = query("li a");
      assert.ok(link.href.endsWith("/u/ossaama/messages/grouperss"));
    });

    test("the item's link has a title for accessibility", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site)
      );
      await render(template);
      const link = query("li a");
      assert.strictEqual(link.title, I18n.t("notifications.titles.mentioned"));
    });

    test("has elements for label and description", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site)
      );
      await render(template);
      const label = query("li a .item-label");
      const description = query("li a .item-description");

      assert.strictEqual(
        label.textContent.trim(),
        "osama",
        "the label's content is the username by default"
      );

      assert.strictEqual(
        description.textContent.trim(),
        "This is fancy title <a>!",
        "the description defaults to the fancy_title"
      );
    });

    test("the description falls back to topic_title from data if fancy_title is absent", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          fancy_title: null,
        })
      );
      await render(template);
      const description = query("li a .item-description");

      assert.strictEqual(
        description.textContent.trim(),
        "this is title before it becomes fancy <a>!",
        "topic_title from data is rendered safely"
      );
    });

    test("fancy_title is emoji-unescaped", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          fancy_title: "title with emoji :phone:",
        })
      );
      await render(template);
      assert.ok(
        exists("li a .item-description img.emoji"),
        "emojis are unescaped when fancy_title is used for description"
      );
    });

    test("topic_title from data is emoji-unescaped safely", async function (assert) {
      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          fancy_title: null,
          data: {
            topic_title: "unsafe title with <a> unescaped emoji :phone:",
          },
        })
      );
      await render(template);
      const description = query("li a .item-description");

      assert.strictEqual(
        description.textContent.trim(),
        "unsafe title with <a> unescaped emoji",
        "topic_title is rendered safely"
      );
      assert.ok(
        exists(".item-description img.emoji"),
        "emoji is rendered correctly"
      );
    });

    test("various aspects can be customized according to the notification's render director", async function (assert) {
      withPluginApi("0.1", (api) => {
        api.registerNotificationTypeRenderer(
          "linked",
          (NotificationTypeBase) => {
            return class extends NotificationTypeBase {
              get classNames() {
                return ["additional", "classes"];
              }

              get linkHref() {
                return "/somewhere/awesome";
              }

              get linkTitle() {
                return "hello world this is unsafe '\"<span>";
              }

              get icon() {
                return "wrench";
              }

              get label() {
                return "notification label 666 <span>";
              }

              get description() {
                return "notification description 123 <script>";
              }

              get labelClasses() {
                return ["label-wrapper-1"];
              }

              get descriptionClasses() {
                return ["description-class-1"];
              }
            };
          }
        );
      });

      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          notification_type: NOTIFICATION_TYPES.linked,
        })
      );

      await render(template);

      assert.ok(
        exists("li.additional.classes"),
        "extra classes are included on the item"
      );

      const link = query("li a");
      assert.ok(
        link.href.endsWith("/somewhere/awesome"),
        "link href is customized"
      );
      assert.strictEqual(
        link.title,
        "hello world this is unsafe '\"<span>",
        "link title is customized and rendered safely"
      );

      assert.ok(exists("svg.d-icon-wrench"), "icon is customized");

      const label = query("li .item-label");
      assert.ok(
        label.classList.contains("label-wrapper-1"),
        "label wrapper has additional classes"
      );
      assert.strictEqual(
        label.textContent.trim(),
        "notification label 666 <span>",
        "label content is customized"
      );

      const description = query(".item-description");
      assert.ok(
        description.classList.contains("description-class-1"),
        "description has additional classes"
      );
      assert.strictEqual(
        description.textContent.trim(),
        "notification description 123 <script>",
        "description content is customized"
      );
    });

    test("description can be omitted", async function (assert) {
      withPluginApi("0.1", (api) => {
        api.registerNotificationTypeRenderer(
          "linked",
          (NotificationTypeBase) => {
            return class extends NotificationTypeBase {
              get description() {
                return null;
              }

              get label() {
                return "notification label";
              }
            };
          }
        );
      });

      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          notification_type: NOTIFICATION_TYPES.linked,
        })
      );

      await render(template);
      assert.notOk(exists(".item-description"), "description is not rendered");
      assert.strictEqual(
        query("li").textContent.trim(),
        "notification label",
        "only label content is displayed"
      );
    });

    test("label can be omitted", async function (assert) {
      withPluginApi("0.1", (api) => {
        api.registerNotificationTypeRenderer(
          "linked",
          (NotificationTypeBase) => {
            return class extends NotificationTypeBase {
              get label() {
                return null;
              }

              get description() {
                return "notification description";
              }
            };
          }
        );
      });

      this.set(
        "item",
        getNotification(this.currentUser, this.siteSettings, this.site, {
          notification_type: NOTIFICATION_TYPES.linked,
        })
      );

      await render(template);
      assert.strictEqual(
        query("li").textContent.trim(),
        "notification description",
        "only notification description is displayed"
      );
      assert.notOk(exists(".item-label"), "label is not rendered");
    });
  }
);

function getMessage(overrides = {}, siteSettings, site) {
  const message = deepMerge(
    cloneJSON(
      PrivateMessagesFixture["/topics/private-messages/eviltrout.json"]
        .topic_list.topics[0]
    ),
    overrides
  );

  return new UserMenuMessageItem({ message, siteSettings, site });
}

module(
  "Integration | Component | user-menu | menu-item | with message items",
  function (hooks) {
    setupRenderingTest(hooks);

    const template = hbs`<UserMenu::MenuItem @item={{this.item}}/>`;

    test("item description is the fancy title of the message", async function (assert) {
      this.set(
        "item",
        getMessage(
          { fancy_title: "This is a <b>safe</b> title!" },
          this.siteSettings,
          this.site
        )
      );
      await render(template);
      assert.strictEqual(
        query("li.message .item-description").textContent.trim(),
        "This is a safe title!"
      );
      assert.strictEqual(
        query("li.message .item-description b").textContent.trim(),
        "safe",
        "fancy title is not escaped"
      );
    });
  }
);

function getBookmark(overrides = {}, siteSettings, site) {
  const bookmark = deepMerge(
    {
      id: 6,
      created_at: "2022-08-05T06:09:39.559Z",
      updated_at: "2022-08-05T06:11:27.246Z",
      name: "",
      reminder_at: "2022-08-05T06:10:42.223Z",
      reminder_at_ics_start: "20220805T061042Z",
      reminder_at_ics_end: "20220805T071042Z",
      pinned: false,
      title: "Test poll topic hello world",
      fancy_title: "Test poll topic hello world",
      excerpt: "poll",
      bookmarkable_id: 1009,
      bookmarkable_type: "Post",
      bookmarkable_url: "http://localhost:4200/t/this-bookmarkable-url/227/1",
      tags: [],
      tags_descriptions: {},
      truncated: true,
      topic_id: 227,
      linked_post_number: 1,
      deleted: false,
      hidden: false,
      category_id: 1,
      closed: false,
      archived: false,
      archetype: "regular",
      highest_post_number: 45,
      last_read_post_number: 31,
      bumped_at: "2022-04-21T15:14:37.359Z",
      slug: "test-poll-topic-hello-world",
      user: {
        id: 1,
        username: "somebody",
        name: "Mr. Somebody",
        avatar_template: "/letter_avatar_proxy/v4/letter/o/f05b48/{size}.png",
      },
    },
    overrides
  );

  return new UserMenuBookmarkItem({ bookmark, siteSettings, site });
}

module(
  "Integration | Component | user-menu | menu-item | with bookmark items",
  function (hooks) {
    setupRenderingTest(hooks);

    const template = hbs`<UserMenu::MenuItem @item={{this.item}}/>`;

    test("uses bookmarkable_url for the href", async function (assert) {
      this.set("item", getBookmark({}, this.siteSettings, this.site));
      await render(template);
      assert.ok(
        query("li.bookmark a").href.endsWith("/t/this-bookmarkable-url/227/1")
      );
    });

    test("item label is the bookmarked post author", async function (assert) {
      this.set(
        "item",
        getBookmark(
          { user: { username: "bookmarkPostAuthor" } },
          this.siteSettings,
          this.site
        )
      );
      await render(template);
      assert.strictEqual(
        query("li.bookmark .item-label").textContent.trim(),
        "bookmarkPostAuthor"
      );
    });

    test("item description is the bookmark title", async function (assert) {
      this.set(
        "item",
        getBookmark(
          { title: "Custom bookmark title" },
          this.siteSettings,
          this.site
        )
      );
      await render(template);
      assert.strictEqual(
        query("li.bookmark .item-description").textContent.trim(),
        "Custom bookmark title"
      );
    });
  }
);

function getReviewable(currentUser, siteSettings, site, overrides = {}) {
  const reviewable = UserMenuReviewable.create(
    Object.assign(
      {
        flagger_username: "sayo2",
        id: 17,
        pending: false,
        post_number: 3,
        topic_fancy_title: "anything hello world",
        type: "Reviewable",
      },
      overrides
    )
  );

  return new UserMenuReviewableItem({
    reviewable,
    currentUser,
    siteSettings,
    site,
  });
}

module(
  "Integration | Component | user-menu | menu-item | with reviewable items",
  function (hooks) {
    setupRenderingTest(hooks);

    const template = hbs`<UserMenu::MenuItem @item={{this.item}}/>`;

    test("doesn't push `reviewed` to the classList if the reviewable is pending", async function (assert) {
      this.set(
        "item",
        getReviewable(this.currentUser, this.siteSettings, this.site, {
          pending: true,
        })
      );
      await render(template);
      assert.ok(!exists("li.reviewed"));
      assert.ok(exists("li"));
    });

    test("pushes `reviewed` to the classList if the reviewable isn't pending", async function (assert) {
      this.set(
        "item",
        getReviewable(this.currentUser, this.siteSettings, this.site, {
          pending: false,
        })
      );
      await render(template);
      assert.ok(exists("li.reviewed"));
    });

    test("has elements for label and description", async function (assert) {
      this.set(
        "item",
        getReviewable(this.currentUser, this.siteSettings, this.site)
      );
      await render(template);

      const label = query("li .item-label");
      const description = query("li .item-description");
      assert.strictEqual(
        label.textContent.trim(),
        "sayo2",
        "the label is the flagger_username"
      );
      assert.strictEqual(
        description.textContent.trim(),
        I18n.t("user_menu.reviewable.default_item", {
          reviewable_id: this.item.reviewable.id,
        }),
        "displays the description for the reviewable"
      );
    });

    test("the item's label is a placeholder that indicates deleted user if flagger_username is absent", async function (assert) {
      this.set(
        "item",
        getReviewable(this.currentUser, this.siteSettings, this.site, {
          flagger_username: null,
        })
      );
      await render(template);
      const label = query("li .item-label");
      assert.strictEqual(
        label.textContent.trim(),
        I18n.t("user_menu.reviewable.deleted_user")
      );
    });
  }
);
