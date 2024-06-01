import { click, render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { count, exists } from "discourse/tests/helpers/qunit-helpers";

module("Integration | Component | uppy-image-uploader", function (hooks) {
  setupRenderingTest(hooks);

  test("with image", async function (assert) {
    await render(hbs`
      <UppyImageUploader @id="test-uppy-image-uploader" @imageUrl="/images/avatar.png" @placeholderUrl="/not/used.png" />
    `);

    assert.strictEqual(
      count(".d-icon-far-image"),
      1,
      "it displays the upload icon"
    );

    assert.strictEqual(
      count(".d-icon-far-trash-alt"),
      1,
      "it displays the trash icon"
    );

    assert.ok(
      !exists(".placeholder-overlay"),
      "it does not display the placeholder image"
    );

    await click(".image-uploader-lightbox-btn");

    assert.strictEqual(
      document.querySelectorAll(".mfp-container").length,
      1,
      "it displays the image lightbox"
    );
  });

  test("without image", async function (assert) {
    await render(hbs`<UppyImageUploader @id="test-uppy-image-uploader" />`);

    assert.strictEqual(
      count(".d-icon-far-image"),
      1,
      "it displays the upload icon"
    );

    assert.ok(
      !exists(".d-icon-far-trash-alt"),
      "it does not display trash icon"
    );

    assert.ok(
      !exists(".image-uploader-lightbox-btn"),
      "it does not display the button to open image lightbox"
    );
  });

  test("with placeholder", async function (assert) {
    await render(
      hbs`<UppyImageUploader @id="test-uppy-image-uploader" @placeholderUrl="/images/avatar.png" />`
    );

    assert.strictEqual(
      count(".d-icon-far-image"),
      1,
      "it displays the upload icon"
    );

    assert.ok(
      !exists(".d-icon-far-trash-alt"),
      "it does not display trash icon"
    );

    assert.ok(
      !exists(".image-uploader-lightbox-btn"),
      "it does not display the button to open image lightbox"
    );

    assert.strictEqual(
      count(".placeholder-overlay"),
      1,
      "it displays the placeholder image"
    );
  });
});
