import { schedule } from "@ember/runloop";
import { escapeExpression } from "discourse/lib/utilities";
import SelectKitRowComponent from "select-kit/components/select-kit/select-kit-row";

export default SelectKitRowComponent.extend({
  classNames: ["create-color-row"],

  didReceiveAttrs() {
    this._super(...arguments);

    schedule("afterRender", () => {
      const color = escapeExpression(this.rowValue);
      this.element.style.borderLeftColor = color.startsWith("#")
        ? color
        : `#${color}`;
    });
  },
});
