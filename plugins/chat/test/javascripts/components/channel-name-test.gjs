import { getOwner } from "@ember/application";
import { render } from "@ember/test-helpers";
import { module, test } from "qunit";
import CoreFabricators from "discourse/lib/fabricators";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { exists, query } from "discourse/tests/helpers/qunit-helpers";
import ChannelName from "discourse/plugins/chat/discourse/components/channel-name";
import ChatFabricators from "discourse/plugins/chat/discourse/lib/fabricators";
import { CHATABLE_TYPES } from "discourse/plugins/chat/discourse/models/chat-channel";

const CHANNEL_NAME_LABEL = ".chat-channel-name__label";

module("Discourse Chat | Component | <ChannelName />", function (hooks) {
  setupRenderingTest(hooks);

  test("category channel - label", async function (assert) {
    const channel = new ChatFabricators(getOwner(this)).channel();

    await render(<template><ChannelName @channel={{channel}} /></template>);

    assert.strictEqual(query(CHANNEL_NAME_LABEL).innerText, channel.title);
  });

  test("category channel - escapes label", async function (assert) {
    const channel = new ChatFabricators(getOwner(this)).channel({
      chatable_type: CHATABLE_TYPES.categoryChannel,
      title: "<div class='xss'>evil</div>",
    });

    await render(<template><ChannelName @channel={{channel}} /></template>);

    assert.false(exists(".xss"));
  });

  test("dm channel - one user", async function (assert) {
    const channel = new ChatFabricators(getOwner(this)).directMessageChannel({
      chatable: new ChatFabricators(getOwner(this)).directMessage({
        users: [new CoreFabricators(getOwner(this)).user()],
      }),
    });
    const user = channel.chatable.users[0];

    await render(<template><ChannelName @channel={{channel}} /></template>);

    assert.strictEqual(
      query(CHANNEL_NAME_LABEL).innerText.trim(),
      user.username
    );
  });

  test("dm channel - multiple users", async function (assert) {
    const channel = new ChatFabricators(getOwner(this)).directMessageChannel({
      users: [
        new CoreFabricators(getOwner(this)).user(),
        new CoreFabricators(getOwner(this)).user(),
        new CoreFabricators(getOwner(this)).user(),
      ],
    });
    channel.chatable.group = true;
    const users = channel.chatable.users;

    await render(<template><ChannelName @channel={{channel}} /></template>);

    assert.strictEqual(
      query(CHANNEL_NAME_LABEL).innerText.trim(),
      users.mapBy("username").join(", ")
    );
  });
});
