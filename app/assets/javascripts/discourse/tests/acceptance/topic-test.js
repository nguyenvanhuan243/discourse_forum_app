import {
  click,
  currentURL,
  fillIn,
  triggerKeyEvent,
  visit,
} from "@ember/test-helpers";
import { test } from "qunit";
import { withPluginApi } from "discourse/lib/plugin-api";
import CategoryFixtures from "discourse/tests/fixtures/category-fixtures";
import topicFixtures from "discourse/tests/fixtures/topic";
import {
  acceptance,
  chromeTest,
  count,
  exists,
  publishToMessageBus,
  query,
  selectText,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { withSilencedDeprecations } from "discourse-common/lib/deprecated";
import { cloneJSON } from "discourse-common/lib/object";
import I18n from "discourse-i18n";

acceptance("Topic", function (needs) {
  needs.user();
  needs.settings({
    post_menu: "read|like|share|flag|edit|bookmark|delete|admin|reply|copyLink",
  });
  needs.pretender((server, helper) => {
    server.get("/c/2/visible_groups.json", () =>
      helper.response(200, {
        groups: [],
      })
    );

    server.get("/c/feature/find_by_slug.json", () => {
      return helper.response(200, CategoryFixtures["/c/1/show.json"]);
    });
    server.put("/posts/398/wiki", () => {
      return helper.response({});
    });
  });

  test("Reply as new topic", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("button.share:nth-of-type(1)");
    await click("button.new-topic");

    assert.ok(exists(".d-editor-input"), "the composer input is visible");

    assert.strictEqual(
      query(".d-editor-input").value.trim(),
      `Continuing the discussion from [Internationalization / localization](${window.location.origin}/t/internationalization-localization/280):`,
      "it fills composer with the ring string"
    );
    assert.strictEqual(
      selectKit(".category-chooser").header().value(),
      "2",
      "it fills category selector with the right category"
    );
  });

  test("Reply as new message", async function (assert) {
    await visit("/t/pm-for-testing/12");
    await click("button.share:nth-of-type(1)");
    await click("button.new-topic");

    assert.ok(exists(".d-editor-input"), "the composer input is visible");

    assert.strictEqual(
      query(".d-editor-input").value.trim(),
      `Continuing the discussion from [PM for testing](${window.location.origin}/t/pm-for-testing/12):`,
      "it fills composer with the ring string"
    );

    const privateMessageUsers = selectKit("#private-message-users");
    assert.strictEqual(
      privateMessageUsers.header().value(),
      "someguy,test,Group",
      "it fills up the composer correctly"
    );
  });

  test("Share Modal", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".topic-post:first-child button.share");

    assert.ok(exists(".share-topic-modal"), "it shows the share modal");
  });

  test("Copy Link Button", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".topic-post:first-child button.post-action-menu__copy-link");

    assert.ok(
      exists(".post-action-menu__copy-link-checkmark"),
      "it shows the Link Copied! message"
    );
  });

  test("Showing and hiding the edit controls", async function (assert) {
    await visit("/t/internationalization-localization/280");

    await click("#topic-title .d-icon-pencil-alt");

    assert.ok(exists("#edit-title"), "it shows the editing controls");
    assert.ok(
      !exists(".title-wrapper .remove-featured-link"),
      "link to remove featured link is not shown"
    );

    await fillIn("#edit-title", "this is the new title");
    await click("#topic-title .cancel-edit");
    assert.ok(!exists("#edit-title"), "it hides the editing controls");
  });

  test("Updating the topic title and category", async function (assert) {
    const categoryChooser = selectKit(".title-wrapper .category-chooser");

    await visit("/t/internationalization-localization/280");

    await click("#topic-title .d-icon-pencil-alt");
    await fillIn("#edit-title", "this is the new title");
    await categoryChooser.expand();
    await categoryChooser.selectRowByValue(4);
    await click("#topic-title .submit-edit");

    assert.strictEqual(
      query("#topic-title .badge-category").innerText,
      "faq",
      "it displays the new category"
    );
    assert.strictEqual(
      query(".fancy-title").innerText.trim(),
      "this is the new title",
      "it displays the new title"
    );
  });

  test("Marking a topic as wiki", async function (assert) {
    await visit("/t/internationalization-localization/280");

    assert.ok(!exists("a.wiki"), "it does not show the wiki icon");

    await click(".topic-post:nth-of-type(1) button.show-more-actions");
    await click(".topic-post:nth-of-type(1) button.show-post-admin-menu");
    await click(".btn.wiki");

    assert.strictEqual(count("button.wiki"), 1, "it shows the wiki icon");
  });

  test("Visit topic routes", async function (assert) {
    await visit("/t/12");

    assert.strictEqual(
      query(".fancy-title").innerText.trim(),
      "PM for testing",
      "it routes to the right topic"
    );

    await visit("/t/280/20");

    assert.strictEqual(
      query(".fancy-title").innerText.trim(),
      "Internationalization / localization",
      "it routes to the right topic"
    );
  });

  test("Updating the topic title with emojis", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#topic-title .d-icon-pencil-alt");

    await fillIn("#edit-title", "emojis title :bike: :blonde_woman:t6:");

    await click("#topic-title .submit-edit");

    assert.ok(
      query(".fancy-title").innerHTML.trim().includes("bike.png"),
      "it displays the new title with emojis"
    );
  });

  test("Updating the topic title with unicode emojis", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#topic-title .d-icon-pencil-alt");

    await fillIn("#edit-title", "emojis title 👨‍🌾🙏");

    await click("#topic-title .submit-edit");

    assert.ok(
      query(".fancy-title").innerHTML.trim().includes("man_farmer.png"),
      "it displays the new title with emojis"
    );
  });

  test("Updating the topic title with unicode emojis without whitespace", async function (assert) {
    this.siteSettings.enable_inline_emoji_translation = true;
    await visit("/t/internationalization-localization/280");
    await click("#topic-title .d-icon-pencil-alt");

    await fillIn("#edit-title", "Test🙂Title");

    await click("#topic-title .submit-edit");

    assert.ok(
      query(".fancy-title")
        .innerHTML.trim()
        .includes("slightly_smiling_face.png"),
      "it displays the new title with emojis"
    );
  });

  test("Suggested topics", async function (assert) {
    await visit("/t/internationalization-localization/280");

    assert.strictEqual(
      query("#suggested-topics-title").innerText.trim(),
      I18n.t("suggested_topics.title")
    );
  });

  test("Deleting a topic", async function (assert) {
    this.siteSettings.min_topic_views_for_delete_confirm = 10000;
    await visit("/t/internationalization-localization/280");
    await click(".topic-post:nth-of-type(1) button.show-more-actions");
    await click(".widget-button.delete");
    await click(".toggle-admin-menu");
    assert.ok(exists(".topic-admin-recover"), "it shows the recover button");
  });

  test("Deleting a popular topic displays confirmation modal", async function (assert) {
    this.siteSettings.min_topic_views_for_delete_confirm = 10;
    await visit("/t/internationalization-localization/280");
    await click(".topic-post:nth-of-type(1) button.show-more-actions");
    await click(".widget-button.delete");
    assert.ok(
      visible(".delete-topic-confirm-modal"),
      "it shows the delete confirmation modal"
    );

    await click(".delete-topic-confirm-modal .btn-primary");
    assert.ok(
      !visible(".delete-topic-confirm-modal"),
      "it hides the delete confirmation modal"
    );
    await click(".widget-button.delete");
    await click(".delete-topic-confirm-modal .btn-danger");
    await click(".toggle-admin-menu");
    assert.ok(exists(".topic-admin-recover"), "it shows the recover button");
  });

  test("Group category moderator posts", async function (assert) {
    await visit("/t/topic-for-group-moderators/2480");

    assert.ok(exists(".category-moderator"), "it has a class applied");
    assert.ok(exists(".d-icon-shield-alt"), "it shows an icon");
  });

  test("Suspended user posts", async function (assert) {
    await visit("/t/topic-from-suspended-user/54077");

    assert.ok(
      exists(".topic-post.user-suspended > #post_1"),
      "it has a class applied"
    );
  });
});

acceptance("Topic featured links", function (needs) {
  needs.user();
  needs.settings({
    topic_featured_link_enabled: true,
    max_topic_title_length: 80,
    exclude_rel_nofollow_domains: "example.com",
    display_name_on_posts: false,
    prioritize_username_in_ux: true,
  });

  test("remove nofollow attribute", async function (assert) {
    await visit("/t/-/299/1");

    const link = query(".title-wrapper .topic-featured-link");
    assert.strictEqual(link.innerText, "example.com");
    assert.strictEqual(link.getAttribute("rel"), "ugc");
  });

  test("remove featured link", async function (assert) {
    await visit("/t/-/299/1");
    assert.ok(
      exists(".title-wrapper .topic-featured-link"),
      "link is shown with topic title"
    );

    await click(".title-wrapper .edit-topic");
    assert.ok(
      exists(".title-wrapper .remove-featured-link"),
      "link to remove featured link"
    );

    // TODO: decide if we want to test this, test is flaky so it
    // was commented out.
    // If not fixed by May 2021, delete this code block
    //
    //await click(".title-wrapper .remove-featured-link");
    //await click(".title-wrapper .submit-edit");
    //assert.ok(!exists(".title-wrapper .topic-featured-link"), "link is gone");
  });

  test("Converting to a public topic", async function (assert) {
    await visit("/t/test-pm/34");
    assert.ok(exists(".private_message"));
    await click(".toggle-admin-menu");
    await click(".topic-admin-convert button");

    let categoryChooser = selectKit(
      ".convert-to-public-topic .category-chooser"
    );
    await categoryChooser.expand();
    await categoryChooser.selectRowByValue(21);

    await click(".convert-to-public-topic .btn-primary");
    assert.ok(!exists(".private_message"));
  });

  test("Unpinning unlisted topic", async function (assert) {
    await visit("/t/internationalization-localization/280");

    await click(".toggle-admin-menu");
    await click(".topic-admin-pin .btn");
    await click(".make-banner");

    await click(".toggle-admin-menu");
    await click(".topic-admin-visible .btn");

    await click(".toggle-admin-menu");
    assert.ok(
      exists(".topic-admin-pin"),
      "it should show the multi select menu"
    );
  });

  test("selecting posts", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".toggle-admin-menu");
    await click(".topic-admin-multi-select .btn");

    assert.ok(
      exists(".selected-posts:not(.hidden)"),
      "it should show the multi select menu"
    );

    assert.ok(
      exists(".select-all"),
      "it should allow users to select all the posts"
    );
  });

  test("select below", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".toggle-admin-menu");
    await click(".topic-admin-multi-select .btn");
    await click("#post_3 .select-below");

    assert.ok(
      query(".selected-posts").innerHTML.includes(
        I18n.t("topic.multi_select.description", { count: 18 })
      ),
      "it should select the right number of posts"
    );

    await click("#post_2 .select-below");

    assert.ok(
      query(".selected-posts").innerHTML.includes(
        I18n.t("topic.multi_select.description", { count: 19 })
      ),
      "it should select the right number of posts"
    );
  });

  test("View Hidden Replies", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".gap");

    assert.ok(!exists(".gap"), "it hides gap");
  });

  test("Quoting a quote keeps the original poster name", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 blockquote");
    await click(".quote-button .insert-quote");

    assert.ok(
      query(".d-editor-input").value.includes(
        'quote="codinghorror said, post:3, topic:280"'
      )
    );
  });

  test("Quoting a quote of a different topic keeps the original topic title", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_9 blockquote");
    await click(".quote-button .insert-quote");

    assert.ok(
      query(".d-editor-input").value.includes(
        'quote="A new topic with a link to another topic, post:3, topic:62"'
      )
    );
  });

  test("Quoting a quote with the Reply button keeps the original poster name", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 blockquote");
    await click(".reply");

    assert.ok(
      query(".d-editor-input").value.includes(
        'quote="codinghorror said, post:3, topic:280"'
      )
    );
  });

  // Using J/K on Firefox clean the text selection, so this won't work there
  chromeTest(
    "Quoting a quote with replyAsNewTopic keeps the original poster name",
    async function (assert) {
      await visit("/t/internationalization-localization/280");
      await selectText("#post_5 blockquote");
      await triggerKeyEvent(document, "keypress", "J");
      await triggerKeyEvent(document, "keypress", "T");

      assert.ok(
        query(".d-editor-input").value.includes(
          'quote="codinghorror said, post:3, topic:280"'
        )
      );
    }
  );

  test("Quoting by selecting text can mark the quote as full", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await selectText("#post_5 .cooked");
    await click(".quote-button .insert-quote");

    assert.ok(
      query(".d-editor-input").value.includes(
        'quote="pekka, post:5, topic:280, full:true"'
      )
    );
  });
});

acceptance("Topic featured links", function (needs) {
  needs.user();
  needs.settings({
    topic_featured_link_enabled: true,
    max_topic_title_length: 80,
  });

  test("remove featured link", async function (assert) {
    await visit("/t/-/299/1");
    assert.ok(
      exists(".title-wrapper .topic-featured-link"),
      "link is shown with topic title"
    );

    await click(".title-wrapper .edit-topic");
    assert.ok(
      exists(".title-wrapper .remove-featured-link"),
      "link to remove featured link"
    );
  });
});

acceptance("Topic with title decorated", function (needs) {
  needs.user();
  needs.hooks.beforeEach(() => {
    withPluginApi("0.8.40", (api) => {
      withSilencedDeprecations("discourse.decorate-topic-title", () => {
        api.decorateTopicTitle((topic, node, topicTitleType) => {
          node.innerText = `${node.innerText}-${topic.id}-${topicTitleType}`;
        });
      });
    });
  });

  test("Decorate topic title", async function (assert) {
    await visit("/t/internationalization-localization/280");

    assert.ok(
      query(".fancy-title").innerText.endsWith("-280-topic-title"),
      "it decorates topic title"
    );

    assert.ok(
      query(".raw-topic-link:nth-child(1)").innerText.endsWith(
        "-27331-topic-list-item-title"
      ),
      "it decorates topic list item title"
    );
  });
});

acceptance("Topic pinning/unpinning as an admin", function (needs) {
  needs.user({ admin: true });

  test("Admin pinning topic", async function (assert) {
    await visit("/t/topic-for-group-moderators/2480");

    await click(".toggle-admin-menu");
    await click(".topic-admin-pin .btn");

    assert.ok(
      exists(".feature-topic .btn-primary"),
      "it should show the 'Pin Topic' button"
    );

    assert.ok(
      exists(".make-banner"),
      "it should show the 'Banner Topic' button"
    );
  });
});

acceptance("Topic pinning/unpinning as a staff member", function (needs) {
  needs.user({ moderator: true, admin: false, trust_level: 2 });

  test("Staff pinning topic", async function (assert) {
    await visit("/t/topic-for-group-moderators/2480");

    await click(".toggle-admin-menu");
    await click(".topic-admin-pin .btn");

    assert.ok(
      exists(".feature-topic .btn-primary"),
      "it should show the 'Pin Topic' button"
    );

    assert.ok(
      exists(".make-banner"),
      "it should show the 'Banner Topic' button"
    );
  });
});

acceptance("Topic pinning/unpinning as a group moderator", function (needs) {
  needs.user({ moderator: false, admin: false, trust_level: 1 });

  test("Group category moderator pinning topic", async function (assert) {
    await visit("/t/topic-for-group-moderators/2480");

    await click(".toggle-admin-menu");
    await click(".topic-admin-pin .btn");

    assert.ok(
      exists(".feature-topic .btn-primary"),
      "it should show the 'Pin Topic' button"
    );

    assert.ok(
      !exists(".make-banner"),
      "it should not show the 'Banner Topic' button"
    );
  });
});

acceptance("Topic last visit line", function (needs) {
  needs.user({ moderator: false, admin: false, trust_level: 1 });

  test("visit topic", async function (assert) {
    await visit("/t/-/280");

    assert.ok(
      exists(".topic-post-visited-line.post-10"),
      "shows the last visited line on the right post"
    );

    await visit("/t/-/9");

    assert.ok(
      !exists(".topic-post-visited-line"),
      "does not show last visited line if post is the last post"
    );
  });
});

acceptance("Topic filter replies to post number", function (needs) {
  needs.settings({
    enable_filtered_replies_view: true,
  });

  test("visit topic", async function (assert) {
    await visit("/t/-/280");

    assert.equal(
      query("#post_3 .show-replies").title,
      I18n.t("post.filtered_replies_hint", { count: 3 }),
      "it displays the right title for filtering by replies"
    );

    await visit("/");
    await visit("/t/-/280?replies_to_post_number=3");

    assert.equal(
      query("#post_3 .show-replies").title,
      I18n.t("post.view_all_posts"),
      "it displays the right title when filtered by replies"
    );
  });
});

acceptance("Navigating between topics", function (needs) {
  needs.pretender((server, helper) => {
    const topicResponse = cloneJSON(topicFixtures["/t/280/1.json"]);
    const firstPost = topicResponse.post_stream.posts[0];
    firstPost.cooked += `\n<a class='same-topic-slugless' href='/t/280'>Link 1</a>`;
    firstPost.cooked += `\n<a class='same-topic-slugless-post' href='/t/280/3'>Link 2</a>`;
    firstPost.cooked += `\n<a class='diff-topic-slugless' href='/t/28830'>Link 3</a>`;
    firstPost.cooked += `\n<a class='diff-topic-slugless-post' href='/t/28830/1'>Link 4</a>`;
    firstPost.cooked += `\n<a class='by-post-id' href='/p/${firstPost.id}'>Link to Post</a>`;

    server.get("/t/280.json", () => helper.response(topicResponse));
    server.get("/t/280/:post_number.json", () =>
      helper.response(topicResponse)
    );
  });

  test("clicking slug-less URLs within the same topic", async function (assert) {
    await visit("/t/-/280");
    await click("a.same-topic-slugless");
    assert.ok(currentURL().includes("/280"));

    await click("a.same-topic-slugless-post");
    assert.ok(currentURL().includes("/280"));
  });

  test("clicking slug-less URLs to a different topic", async function (assert) {
    await visit("/t/-/280");
    await click("a.diff-topic-slugless");
    assert.ok(currentURL().includes("/28830"));

    await visit("/t/-/280");
    await click("a.diff-topic-slugless-post");
    assert.ok(currentURL().includes("/28830"));
  });

  test("clicking post URLs", async function (assert) {
    await visit("/t/-/280");
    await click("a.by-post-id");
    assert.ok(currentURL().includes("/280"));
  });
});

acceptance("Topic stats update automatically", function () {
  test("Likes count updates automatically", async function (assert) {
    await visit("/t/internationalization-localization/280");

    const likesCountSelectors = "#post_1 .topic-map .likes .number";
    const oldLikesCount = query(likesCountSelectors).textContent;
    const likesChangedFixture = {
      id: 280,
      type: "stats",
      like_count: parseInt(oldLikesCount, 10) + 42,
    };
    const expectedLikesCount = likesChangedFixture.like_count.toString();

    // simulate the topic like_count being changed
    await publishToMessageBus("/topic/280", likesChangedFixture);

    assert.dom(likesCountSelectors).hasText(expectedLikesCount);
    assert.notEqual(
      oldLikesCount,
      expectedLikesCount,
      "it updates the likes count on the topic stats"
    );
  });

  const postsChangedFixture = {
    id: 280,
    type: "stats",
    posts_count: 999,
    last_posted_at: "2022-06-20T21:01:45.844Z",
    last_poster: {
      id: 1,
      username: "test",
      name: "Mr. Tester",
      avatar_template: "/images/d-logo-sketch-small.png",
    },
  };

  test("Replies count updates automatically", async function (assert) {
    await visit("/t/internationalization-localization/280");

    const repliesCountSelectors = "#post_1 .topic-map .replies .number";
    const oldRepliesCount = query(repliesCountSelectors).textContent;
    const expectedRepliesCount = (
      postsChangedFixture.posts_count - 1
    ).toString();

    // simulate the topic posts_count being changed
    await publishToMessageBus("/topic/280", postsChangedFixture);

    assert.dom(repliesCountSelectors).hasText(expectedRepliesCount);
    assert.notEqual(
      oldRepliesCount,
      expectedRepliesCount,
      "it updates the replies count on the topic stats"
    );
  });

  test("Last replier avatar updates automatically", async function (assert) {
    await visit("/t/internationalization-localization/280");
    const avatarSelectors = "#post_1 .topic-map .last-reply .avatar";
    const avatarImg = query(avatarSelectors);

    const oldAvatarTitle = avatarImg.title;
    const oldAvatarSrc = avatarImg.src;
    const expectedAvatarTitle = postsChangedFixture.last_poster.name;
    const expectedAvatarSrc = postsChangedFixture.last_poster.avatar_template;

    // simulate the topic posts_count being changed
    await publishToMessageBus("/topic/280", postsChangedFixture);

    assert.dom(avatarSelectors).hasAttribute("title", expectedAvatarTitle);
    assert.notEqual(
      oldAvatarTitle,
      expectedAvatarTitle,
      "it updates the last poster avatar title on the topic stats"
    );

    assert.dom(avatarSelectors).hasAttribute("src", expectedAvatarSrc);
    assert.notEqual(
      oldAvatarSrc,
      expectedAvatarSrc,
      "it updates the last poster avatar src on the topic stats"
    );
  });

  test("Last replied at updates automatically", async function (assert) {
    await visit("/t/internationalization-localization/280");

    const lastRepliedAtSelectors =
      "#post_1 .topic-map .last-reply .relative-date";
    const lastRepliedAtDisplay = query(lastRepliedAtSelectors);
    const oldTime = lastRepliedAtDisplay.dataset.time;
    const expectedTime = Date.parse(
      postsChangedFixture.last_posted_at
    ).toString();

    // simulate the topic posts_count being changed
    await publishToMessageBus("/topic/280", postsChangedFixture);

    assert.dom(lastRepliedAtSelectors).hasAttribute("data-time", expectedTime);
    assert.notEqual(
      oldTime,
      expectedTime,
      "it updates the last posted time on the topic stats"
    );
  });
});
