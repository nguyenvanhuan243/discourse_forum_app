import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { withPluginApi } from "discourse/lib/plugin-api";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance(
  "Topic - Plugin API - registerTopicFooterButton - logged in user",
  function (needs) {
    needs.user();

    test("adds topic footer button through API", async function (assert) {
      const done = assert.async();
      withPluginApi("0.13.1", (api) => {
        api.registerTopicFooterButton({
          id: "my-button",
          icon: "cog",
          action() {
            assert.step("action called");
            done();
          },
        });
      });

      await visit("/t/internationalization-localization/280");
      await click("#topic-footer-button-my-button");

      assert.verifySteps(["action called"]);
    });

    test("doesn't show footer button if anonymousOnly is true", async function (assert) {
      withPluginApi("0.13.1", (api) => {
        api.registerTopicFooterButton({
          id: "my-button",
          icon: "cog",
          action() {},
          anonymousOnly: true,
        });
      });

      await visit("/t/internationalization-localization/280");
      assert.ok(!exists("#topic-footer-button-my-button"));
    });
  }
);

acceptance(
  "Topic - Plugin API - registerTopicFooterButton - anonymous",
  function () {
    test("adds topic footer button through API", async function (assert) {
      const done = assert.async();
      withPluginApi("0.13.1", (api) => {
        api.registerTopicFooterButton({
          id: "my-button",
          icon: "cog",
          action() {
            assert.step("action called");
            done();
          },
          anonymousOnly: true,
        });
      });

      await visit("/t/internationalization-localization/280");
      await click("#topic-footer-button-my-button");

      assert.verifySteps(["action called"]);
    });

    test("doesn't show footer button if anonymousOnly is false/unset", async function (assert) {
      withPluginApi("0.13.1", (api) => {
        api.registerTopicFooterButton({
          id: "my-button",
          icon: "cog",
          action() {},
        });
      });

      await visit("/t/internationalization-localization/280");
      assert.ok(!exists("#topic-footer-button-my-button"));
    });
  }
);
