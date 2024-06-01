import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import { isLTR, isRTL, setTextDirections } from "discourse/lib/text-direction";

function quoteHtml() {
  return `
    <aside class="quote">
      <div class="title">
        <img src="/images/avatar.png"> osama:
      </div>
      <blockquote>
        <p>كلمات بالعربي هنا</p>
        <p>English words here!!</p>
        <aside class="quote">
          <div class="title">
            <img src="/images/avatar.png"> أسامة:
          </div>
          <blockquote>
            <p>English words here (nested quote)</p>
            <p>كلمات بالعربي هنا (اقتباس متداخل)</p>
          </blockquote>
        </aside>
      </blockquote>
    </aside>
    <p>Testing quotes with mixed text direction!</p>
    <p>تجربة الاقتباسات مع نصوص باتجاهات مختلفة</p>
  `;
}

function assertDirection(assert, elem, expected, message) {
  assert.strictEqual(elem.getAttribute("dir"), expected, message);
}

module("Unit | Utility | text-direction", function (hooks) {
  setupTest(hooks);

  test("isRTL", function (assert) {
    // Hebrew
    assert.strictEqual(isRTL("זה מבחן"), true);

    // Arabic
    assert.strictEqual(isRTL("هذا اختبار"), true);

    // Persian
    assert.strictEqual(isRTL("این یک امتحان است"), true);

    assert.strictEqual(isRTL("This is a test"), false);
    assert.strictEqual(isRTL(""), false);
  });

  test("isLTR", function (assert) {
    assert.strictEqual(isLTR("This is a test"), true);
    assert.strictEqual(isLTR("זה מבחן"), false);
  });

  test("setTextDirections", function (assert) {
    const cooked = document.createElement("div");
    cooked.classList.add("cooked");
    cooked.innerHTML = quoteHtml();
    setTextDirections(cooked);

    const [englishTitle, arabicTitle] = Array.from(
      cooked.querySelectorAll(".title")
    );
    assertDirection(
      assert,
      englishTitle,
      "ltr",
      "quote title always matches site direction regardless of its content"
    );
    assertDirection(
      assert,
      arabicTitle,
      "ltr",
      "quote title always matches site direction regardless of its content"
    );

    const [
      quotedRtl,
      quotedLtr,
      quotedLtrNested,
      quotedRtlNested,
      notQuotedLtr,
      notQuotedRtl,
    ] = Array.from(cooked.querySelectorAll("p"));

    assertDirection(
      assert,
      quotedRtl,
      "auto",
      "RTL paragraphs inside quote have auto dir"
    );
    assertDirection(
      assert,
      quotedLtr,
      "auto",
      "LTR paragraphs inside quote have auto dir"
    );
    assertDirection(
      assert,
      quotedLtrNested,
      "auto",
      "LTR paragraphs inside nested quote have auto dir"
    );
    assertDirection(
      assert,
      quotedRtlNested,
      "auto",
      "RTL paragraphs inside nested quote have auto dir"
    );
    assertDirection(
      assert,
      notQuotedLtr,
      "auto",
      "LTR paragraphs outside quotes have auto dir"
    );
    assertDirection(
      assert,
      notQuotedRtl,
      "auto",
      "RTL paragraphs outside quotes have auto dir"
    );
  });
});
