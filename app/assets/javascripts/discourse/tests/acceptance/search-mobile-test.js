import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  count,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";

acceptance("Search - Mobile", function (needs) {
  needs.mobileView();

  test("search", async function (assert) {
    await visit("/");

    await click("#search-button");

    assert.ok(
      exists("input.full-page-search"),
      "it shows the full page search form"
    );

    assert.ok(!exists(".search-results .fps-topic"), "no results by default");

    await click(".advanced-filters summary");

    assert.ok(
      exists(".advanced-filters[open]"),
      "it should expand advanced search filters"
    );

    await fillIn(".search-query", "discourse");
    await click(".search-cta");

    assert.strictEqual(count(".fps-topic"), 1, "has one post");

    assert.notOk(
      exists(".advanced-filters[open]"),
      "it should collapse advanced search filters"
    );

    await click("#search-button");

    assert.strictEqual(
      query("input.full-page-search").value,
      "discourse",
      "it does not reset input when hitting search icon again"
    );
  });
});
