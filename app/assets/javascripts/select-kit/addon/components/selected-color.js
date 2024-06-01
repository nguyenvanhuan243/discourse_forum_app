import { schedule } from "@ember/runloop";
import { escapeExpression } from "discourse/lib/utilities";
import SelectedNameComponent from "select-kit/components/selected-name";

export default SelectedNameComponent.extend({
  classNames: ["select-kit-selected-color"],

  didInsertElement() {
    this._super(...arguments);

    schedule("afterRender", () => {
      const element = document.querySelector(
        `#${this.selectKit.uniqueID} #${this.id}`
      );

      if (!element) {
        return;
      }

      element.style.borderBottom = "2px solid transparent";
      const color = escapeExpression(this.name);
      element.style.borderBottomColor = `#${color}`;
    });
  },
});
