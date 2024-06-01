import { computed } from "@ember/object";
import { readOnly } from "@ember/object/computed";
import Mixin from "@ember/object/mixin";
import { isPresent } from "@ember/utils";
import { deepEqual } from "discourse-common/lib/object";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Mixin.create({
  @discourseComputed("value", "default")
  overridden(val, defaultVal) {
    if (val === null) {
      val = "";
    }
    if (defaultVal === null) {
      defaultVal = "";
    }

    return !deepEqual(val, defaultVal);
  },

  computedValueProperty: computed(
    "valueProperty",
    "validValues.[]",
    function () {
      if (isPresent(this.valueProperty)) {
        return this.valueProperty;
      }

      if (isPresent(this.validValues.get("firstObject.value"))) {
        return "value";
      } else {
        return null;
      }
    }
  ),

  computedNameProperty: computed("nameProperty", "validValues.[]", function () {
    if (isPresent(this.nameProperty)) {
      return this.nameProperty;
    }

    if (isPresent(this.validValues.get("firstObject.name"))) {
      return "name";
    } else {
      return null;
    }
  }),

  @discourseComputed("valid_values")
  validValues(validValues) {
    const values = [];
    const translateNames = this.translate_names;

    (validValues || []).forEach((v) => {
      if (v.name && v.name.length > 0 && translateNames) {
        values.addObject({ name: I18n.t(v.name), value: v.value });
      } else {
        values.addObject(v);
      }
    });
    return values;
  },

  @discourseComputed("valid_values")
  allowsNone(validValues) {
    if (validValues?.includes("")) {
      return "admin.settings.none";
    }
  },

  anyValue: readOnly("allow_any"),
});
