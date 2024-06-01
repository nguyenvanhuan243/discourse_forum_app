import { setOwner } from "@ember/application";
import { registerDestructor } from "@ember/destroyable";
import EmberObject from "@ember/object";
import { next, schedule } from "@ember/runloop";
import { service } from "@ember/service";
import TextareaTextManipulation from "discourse/mixins/textarea-text-manipulation";

// This class sole purpose is to provide a way to interact with the textarea
// using the existing TextareaTextManipulation mixin without using it directly
// in the composer component. It will make future migration easier.
export default class TextareaInteractor extends EmberObject.extend(
  TextareaTextManipulation
) {
  @service capabilities;
  @service site;
  @service siteSettings;

  constructor(owner, textarea) {
    super(...arguments);
    setOwner(this, owner);
    this.textarea = textarea;
    this._textarea = textarea;
    this.element = this._textarea;
    this.ready = true;
    this.composerFocusSelector = `#${textarea.id}`;

    this.init(); // mixin init wouldn't be called otherwise
    this.composerEventPrefix = null; // we don't need app events

    // paste is using old native ember events defined on composer
    this.textarea.addEventListener("paste", this.paste);
    registerDestructor(this, (instance) => instance.teardown());
  }

  teardown() {
    this.textarea.removeEventListener("paste", this.paste);
  }

  set value(value) {
    this._textarea.value = value;
    const event = new Event("input", {
      bubbles: true,
      cancelable: true,
    });
    this._textarea.dispatchEvent(event);
  }

  blur() {
    next(() => {
      schedule("afterRender", () => {
        this._textarea.blur();
      });
    });
  }

  focus(opts = { ensureAtEnd: false, refreshHeight: true, addText: null }) {
    next(() => {
      schedule("afterRender", () => {
        if (opts.refreshHeight) {
          this.refreshHeight();
        }

        if (opts.ensureAtEnd) {
          this.ensureCaretAtEnd();
        }

        if (this.capabilities.isIpadOS || this.site.mobileView) {
          return;
        }

        if (opts.addText) {
          this.addText(this.getSelected(), opts.addText);
        }

        this.focusTextArea();
      });
    });
  }

  ensureCaretAtEnd() {
    schedule("afterRender", () => {
      this._textarea.setSelectionRange(
        this._textarea.value.length,
        this._textarea.value.length
      );
    });
  }

  refreshHeight() {
    schedule("afterRender", () => {
      // this is a quirk which forces us to `auto` first or textarea
      // won't resize
      this._textarea.style.height = "auto";

      // +1 is to workaround a rounding error visible on electron
      // causing scrollbars to show when they shouldn’t
      this._textarea.style.height = this._textarea.scrollHeight + 1 + "px";
    });
  }
}
