import Component from "@ember/component";
import { htmlSafe } from "@ember/template";
import { getURLWithCDN } from "discourse-common/lib/get-url";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  tagName: "",

  @discourseComputed("src")
  cdnSrc(src) {
    return getURLWithCDN(src);
  },

  @discourseComputed("width", "height")
  style(width, height) {
    if (width && height) {
      return htmlSafe(`--aspect-ratio: ${width / height};`);
    }
  },
});
