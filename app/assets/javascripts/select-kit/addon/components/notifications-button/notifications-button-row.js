import { computed } from "@ember/object";
import { readOnly } from "@ember/object/computed";
import { escapeExpression } from "discourse/lib/utilities";
import I18n from "discourse-i18n";
import DropdownSelectBoxRowComponent from "select-kit/components/dropdown-select-box/dropdown-select-box-row";

export default DropdownSelectBoxRowComponent.extend({
  classNames: ["notifications-button-row"],
  i18nPrefix: readOnly("selectKit.options.i18nPrefix"),
  i18nPostfix: readOnly("selectKit.options.i18nPostfix"),

  label: computed("_start", function () {
    return escapeExpression(I18n.t(`${this._start}.title`));
  }),

  icons: computed("item.icon", function () {
    return [escapeExpression(this.item.icon)];
  }),

  description: computed("_start", function () {
    if (this.site && this.site.mobileView) {
      return null;
    }

    return escapeExpression(I18n.t(`${this._start}.description`));
  }),

  _start: computed("i18nPrefix", "i18nPostfix", "rowName", function () {
    return `${this.i18nPrefix}.${this.rowName}${this.i18nPostfix}`;
  }),
});
