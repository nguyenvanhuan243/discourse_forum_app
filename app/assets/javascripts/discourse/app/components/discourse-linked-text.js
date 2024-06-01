import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Component.extend({
  tagName: "span",

  @discourseComputed("text", "textParams")
  translatedText(text) {
    if (text) {
      return I18n.t(...arguments);
    }
  },

  click(event) {
    if (event.target.tagName.toUpperCase() === "A") {
      this.action(this.actionParam);
    }

    return false;
  },
});
