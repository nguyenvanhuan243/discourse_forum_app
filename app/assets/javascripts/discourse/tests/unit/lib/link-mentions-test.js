import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import {
  fetchUnseenMentions,
  linkSeenMentions,
} from "discourse/lib/link-mentions";
import pretender, { response } from "discourse/tests/helpers/create-pretender";
import domFromString from "discourse-common/lib/dom-from-string";

module("Unit | Utility | link-mentions", function (hooks) {
  setupTest(hooks);

  test("linkSeenMentions replaces users and groups", async function (assert) {
    pretender.get("/composer/mentions", () =>
      response({
        users: ["valid_user"],
        user_reasons: {},
        groups: {
          valid_group: { user_count: 1 },
          mentionable_group: { user_count: 1 },
        },
        group_reasons: { valid_group: "not_mentionable" },
        max_users_notified_per_group_mention: 100,
      })
    );

    await fetchUnseenMentions({
      names: ["valid_user", "mentionable_group", "valid_group", "invalid"],
    });

    const root = domFromString(`
      <div>
        <span class="mention">@invalid</span>
        <span class="mention">@valid_user</span>
        <span class="mention">@valid_group</span>
        <span class="mention">@mentionable_group</span>
      </div>
    `)[0];
    await linkSeenMentions(root);

    assert.strictEqual(root.querySelector("a").innerText, "@valid_user");
    assert.strictEqual(root.querySelectorAll("a")[1].innerText, "@valid_group");
    assert.strictEqual(
      root.querySelector("a[data-mentionable-user-count]").innerText,
      "@mentionable_group"
    );
    assert.strictEqual(
      root.querySelector("span.mention").innerHTML,
      "@invalid"
    );
  });
});
