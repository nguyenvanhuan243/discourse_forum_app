import Component from "@ember/component";
import { computed } from "@ember/object";
import { guidFor } from "@ember/object/internals";
import UtilsMixin from "select-kit/mixins/utils";

export default Component.extend(UtilsMixin, {
  tagName: "",
  item: null,
  selectKit: null,
  extraClass: null,
  id: null,

  init() {
    this._super(...arguments);

    this.set("id", guidFor(this));
  },

  itemValue: computed("item", function () {
    return this.getValue(this.item);
  }),

  itemName: computed("item", function () {
    return this.getName(this.item);
  }),

  mandatoryValuesArray: computed("item", function () {
    return this.get("mandatoryValues")?.split("|") || [];
  }),

  readOnly: computed("item", function () {
    return this.mandatoryValuesArray.includes(this.item.id);
  }),
});
