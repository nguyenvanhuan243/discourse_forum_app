import Component from "@ember/component";
import { htmlSafe } from "@ember/template";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Component.extend({
  tagName: "button",
  attributeBindings: ["style", "title"],
  classNameBindings: [":colorpicker", "isUsed:used-color:unused-color"],

  @discourseComputed("color", "usedColors")
  isUsed(color, usedColors) {
    return (usedColors || []).includes(color.toUpperCase());
  },

  @discourseComputed("isUsed")
  title(isUsed) {
    return isUsed ? I18n.t("category.already_used") : null;
  },

  @discourseComputed("color")
  style(color) {
    return htmlSafe(`background-color: #${color};`);
  },

  click(e) {
    e.preventDefault();
    this.selectColor(this.color);
  },
});
