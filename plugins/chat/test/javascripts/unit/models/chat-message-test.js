import { getOwner } from "@ember/application";
import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import ChatFabricators from "discourse/plugins/chat/discourse/lib/fabricators";
import ChatMessage from "discourse/plugins/chat/discourse/models/chat-message";

module("Discourse Chat | Unit |  Models | chat-message", function (hooks) {
  setupTest(hooks);

  test(".persisted", function (assert) {
    const channel = new ChatFabricators(getOwner(this)).channel();
    let message = ChatMessage.create(channel, { id: null });
    assert.strictEqual(message.persisted, false);

    message = ChatMessage.create(channel, {
      id: 1,
      staged: true,
    });
    assert.strictEqual(message.persisted, false);

    message = ChatMessage.create(channel, {
      id: 1,
      staged: false,
    });
    assert.strictEqual(message.persisted, true);
  });
});
