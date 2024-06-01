import { click, triggerEvent, visit, waitFor } from "@ember/test-helpers";
import $ from "jquery";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("Sidebar - Narrow Desktop", function (needs) {
  needs.user();

  needs.settings({
    navigation_menu: "sidebar",
  });

  needs.hooks.afterEach(function () {
    document.body.style.width = null;
  });

  test("wide sidebar is changed to cloak when resize to narrow screen", async function (assert) {
    await visit("/");
    assert.ok(exists("#d-sidebar"), "wide sidebar is displayed");

    await click(".header-sidebar-toggle .btn");

    assert.ok(!exists("#d-sidebar"), "wide sidebar is collapsed");

    await click(".header-sidebar-toggle .btn");

    assert.ok(exists("#d-sidebar"), "wide sidebar is displayed");

    document.body.style.width = "767px";

    await waitFor(".btn-sidebar-toggle.narrow-desktop", {
      timeout: 5000,
    });
    await click(".btn-sidebar-toggle");

    assert.ok(
      exists(".sidebar-hamburger-dropdown"),
      "cloak sidebar is displayed"
    );

    await triggerEvent(document.querySelector(".header-cloak"), "pointerdown");

    assert.ok(
      !exists(".sidebar-hamburger-dropdown"),
      "cloak sidebar is collapsed"
    );

    document.body.style.width = "1200px";
    await waitFor("#d-sidebar", {
      timeout: 5000,
    });
    assert.ok(exists("#d-sidebar"), "wide sidebar is displayed");
  });

  test("transition from narrow screen to wide screen", async function (assert) {
    await visit("/");

    document.body.style.width = "767px";

    await waitFor(".btn-sidebar-toggle.narrow-desktop", {
      timeout: 5000,
    });
    await click(".btn-sidebar-toggle");

    document.body.style.width = "1200px";
    await waitFor("#d-sidebar", {
      timeout: 5000,
    });

    await click(".header-dropdown-toggle.current-user button");
    $(".header-dropdown-toggle.current-user").click();

    assert.ok(exists(".quick-access-panel"));
  });
});
