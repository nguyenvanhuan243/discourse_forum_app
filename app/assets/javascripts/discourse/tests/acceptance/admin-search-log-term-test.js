import { visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("Admin - Search Log Term", function (needs) {
  needs.user();

  test("show search log term details", async function (assert) {
    await visit("/admin/logs/search_logs/term?term=ruby");

    assert.ok(exists(".search-logs-filter"), "has the search type filter");
    assert.ok(exists("canvas"), "has graph canvas");
    assert.ok(exists("div.header-search-results"), "has header search results");
  });
});
