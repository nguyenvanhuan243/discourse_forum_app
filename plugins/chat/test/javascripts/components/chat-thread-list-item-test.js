import { getOwner } from "@ember/application";
import { render } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { query } from "discourse/tests/helpers/qunit-helpers";
import ChatFabricators from "discourse/plugins/chat/discourse/lib/fabricators";

module("Discourse Chat | Component | chat-thread-list-item", function (hooks) {
  setupRenderingTest(hooks);

  test("it safely renders title", async function (assert) {
    const title = "<style>body { background: red;}</style>";
    this.thread = new ChatFabricators(getOwner(this)).thread({ title });

    await render(hbs`
      <Chat::ThreadList::Item @thread={{this.thread}} />
    `);

    assert.equal(
      query(".chat-thread-list-item__title").innerHTML.trim(),
      "&lt;style&gt;body { background: red;}&lt;/style&gt;"
    );
  });
});
