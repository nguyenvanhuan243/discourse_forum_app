import { computed } from "@ember/object";
import { readOnly } from "@ember/object/computed";
import SingleSelectHeaderComponent from "select-kit/components/select-kit/single-select-header";

export default SingleSelectHeaderComponent.extend({
  classNames: ["dropdown-select-box-header"],
  classNameBindings: ["btnClassName", "btnStyleClass", "btnCustomClasses"],
  showFullTitle: readOnly("selectKit.options.showFullTitle"),
  customStyle: readOnly("selectKit.options.customStyle"),

  btnCustomClasses: readOnly("selectKit.options.btnCustomClasses"),

  btnClassName: computed("showFullTitle", function () {
    return `btn ${this.showFullTitle ? "btn-icon-text" : "no-text btn-icon"}`;
  }),

  btnStyleClass: computed("customStyle", function () {
    return `${this.customStyle ? "" : "btn-default"}`;
  }),

  caretUpIcon: readOnly("selectKit.options.caretUpIcon"),
  caretDownIcon: readOnly("selectKit.options.caretDownIcon"),

  caretIcon: computed(
    "selectKit.isExpanded",
    "caretUpIcon",
    "caretDownIcon",
    function () {
      return this.selectKit.isExpanded ? this.caretUpIcon : this.caretDownIcon;
    }
  ),
});
