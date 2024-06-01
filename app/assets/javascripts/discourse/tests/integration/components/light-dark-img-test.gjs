import { getOwner } from "@ember/application";
import { render } from "@ember/test-helpers";
import { module, test } from "qunit";
import LigthDarkImg from "discourse/components/light-dark-img";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { count, exists, query } from "discourse/tests/helpers/qunit-helpers";

const lightSrc = { url: "/images/light.jpg", width: 376, height: 500 };
const darkSrc = { url: "/images/light.jpg", width: 432, height: 298 };

module("Integration | Component | light-dark-img", function (hooks) {
  setupRenderingTest(hooks);

  hooks.afterEach(function () {
    this.session = getOwner(this).lookup("service:session");
    this.session.set("darkModeAvailable", null);
    this.session.set("defaultColorSchemeIsDark", null);
  });

  test("light theme with no images provided | dark mode not available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", false);
    this.session.set("darkModeAvailable", false);

    await render(<template><LigthDarkImg /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.ok(!exists("img"), "there is no img tag");
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("light theme with only light image provided | dark mode not available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", false);
    this.session.set("darkModeAvailable", false);

    await render(<template><LigthDarkImg @lightImg={{lightSrc}} /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      lightSrc.url,
      "the img src is the light image"
    );
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("light theme with light and dark images provided | dark mode not available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", false);
    this.session.set("darkModeAvailable", false);

    await render(<template>
      <LigthDarkImg @lightImg={{lightSrc}} @darkImg={{darkSrc}} />
    </template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      lightSrc.url,
      "the img src is the light image"
    );
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("light theme with no images provided | dark mode available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", false);
    this.session.set("darkModeAvailable", true);

    await render(<template><LigthDarkImg /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.ok(!exists("img"), "there is no img tag");
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("light theme with only light image provided | dark mode available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", false);
    this.session.set("darkModeAvailable", true);

    await render(<template><LigthDarkImg @lightImg={{lightSrc}} /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      lightSrc.url,
      "the img src is the light image"
    );
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("light theme with light and dark images provided | dark mode available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", false);
    this.session.set("darkModeAvailable", true);

    await render(<template>
      <LigthDarkImg @lightImg={{lightSrc}} @darkImg={{darkSrc}} />
    </template>);

    assert.strictEqual(count("picture"), 1, "there is a picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      lightSrc.url,
      "the img src is the light image"
    );
    assert.strictEqual(count("source"), 1, "there is a source tag");
    assert.strictEqual(
      query("source").getAttribute("srcset"),
      darkSrc.url,
      "the source srcset is the dark image"
    );
  });

  test("dark theme with no images provided | dark mode not available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", true);
    this.session.set("darkModeAvailable", false);

    await render(<template><LigthDarkImg /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.ok(!exists("img"), "there is no img tag");
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("dark theme with only light image provided | dark mode not available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", true);
    this.session.set("darkModeAvailable", false);

    await render(<template><LigthDarkImg @lightImg={{lightSrc}} /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      lightSrc.url,
      "the img src is the light image"
    );
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("dark theme with light and dark images provided | dark mode not available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", true);
    this.session.set("darkModeAvailable", false);

    await render(<template>
      <LigthDarkImg @lightImg={{lightSrc}} @darkImg={{darkSrc}} />
    </template>);

    assert.strictEqual(count("picture"), 1, "there is a picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      darkSrc.url,
      "the img src is the dark image"
    );
    assert.strictEqual(count("source"), 1, "there is a source tag");
    assert.strictEqual(
      query("source").getAttribute("srcset"),
      darkSrc.url,
      "the source srcset is the dark image"
    );
  });

  test("dark theme with no images provided | dark mode available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", true);
    this.session.set("darkModeAvailable", true);

    await render(<template><LigthDarkImg /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.ok(!exists("img"), "there is no img tag");
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("dark theme with only light image provided | dark mode available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", true);
    this.session.set("darkModeAvailable", true);

    await render(<template><LigthDarkImg @lightImg={{lightSrc}} /></template>);

    assert.ok(!exists("picture"), "there is no picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      lightSrc.url,
      "the img src is the light image"
    );
    assert.ok(!exists("source"), "there are no source tags");
  });

  test("dark theme with light and dark images provided | dark mode available", async function (assert) {
    this.session.set("defaultColorSchemeIsDark", true);
    this.session.set("darkModeAvailable", true);

    await render(<template>
      <LigthDarkImg @lightImg={{lightSrc}} @darkImg={{darkSrc}} />
    </template>);

    assert.strictEqual(count("picture"), 1, "there is a picture tag");
    assert.strictEqual(count("img"), 1, "there is an img tag");
    assert.strictEqual(
      query("img").getAttribute("src"),
      darkSrc.url,
      "the img src is the dark image"
    );
    assert.strictEqual(count("source"), 1, "there is a source tag");
    assert.strictEqual(
      query("source").getAttribute("srcset"),
      darkSrc.url,
      "the source srcset is the dark image"
    );
  });
});
