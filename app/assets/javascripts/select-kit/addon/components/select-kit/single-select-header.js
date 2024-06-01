import { computed } from "@ember/object";
import { or } from "@ember/object/computed";
import I18n from "discourse-i18n";
import SelectKitHeaderComponent from "select-kit/components/select-kit/select-kit-header";
import UtilsMixin from "select-kit/mixins/utils";

export default SelectKitHeaderComponent.extend(UtilsMixin, {
  tagName: "summary",
  classNames: ["single-select-header"],
  attributeBindings: ["name", "ariaLabel:aria-label"],
  ariaLabel: or("selectKit.options.headerAriaLabel", "name"),

  focusIn(event) {
    event.stopImmediatePropagation();

    document.querySelectorAll(".select-kit-header").forEach((header) => {
      if (header !== event.target) {
        header.parentNode.open = false;
      }
    });
  },

  name: computed("selectedContent.name", function () {
    if (this.selectedContent) {
      return I18n.t("select_kit.filter_by", {
        name: this.getName(this.selectedContent),
      });
    } else {
      return I18n.t("select_kit.select_to_filter");
    }
  }),
});
