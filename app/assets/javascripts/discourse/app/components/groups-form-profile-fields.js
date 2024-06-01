import Component from "@ember/component";
import EmberObject from "@ember/object";
import { not } from "@ember/object/computed";
import { isEmpty } from "@ember/utils";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Group from "discourse/models/group";
import discourseDebounce from "discourse-common/lib/debounce";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Component.extend({
  disableSave: null,
  nameInput: null,

  didInsertElement() {
    this._super(...arguments);
    const name = this.get("model.name");

    if (name) {
      this.set("nameInput", name);
    } else {
      this.set("disableSave", true);
    }
  },

  canEdit: not("model.automatic"),

  @discourseComputed("basicNameValidation", "uniqueNameValidation")
  nameValidation(basicNameValidation, uniqueNameValidation) {
    return uniqueNameValidation ? uniqueNameValidation : basicNameValidation;
  },

  @observes("nameInput")
  _validateName() {
    if (this.nameInput === this.get("model.name")) {
      return;
    }

    if (this.nameInput === undefined) {
      return this._failedInputValidation();
    }

    if (this.nameInput === "") {
      this.set("uniqueNameValidation", null);
      return this._failedInputValidation(I18n.t("admin.groups.new.name.blank"));
    }

    if (this.nameInput.length < this.siteSettings.min_username_length) {
      return this._failedInputValidation(
        I18n.t("admin.groups.new.name.too_short")
      );
    }

    if (this.nameInput.length > this.siteSettings.max_username_length) {
      return this._failedInputValidation(
        I18n.t("admin.groups.new.name.too_long")
      );
    }

    this.checkGroupNameDebounced();

    return this._failedInputValidation(
      I18n.t("admin.groups.new.name.checking")
    );
  },

  checkGroupNameDebounced() {
    discourseDebounce(this, this._checkGroupName, 500);
  },

  _checkGroupName() {
    if (isEmpty(this.nameInput)) {
      return;
    }

    Group.checkName(this.nameInput)
      .then((response) => {
        const validationName = "uniqueNameValidation";

        if (response.available) {
          this.set(
            validationName,
            EmberObject.create({
              ok: true,
              reason: I18n.t("admin.groups.new.name.available"),
            })
          );

          this.set("disableSave", false);
          this.set("model.name", this.nameInput);
        } else {
          let reason;

          if (response.errors) {
            reason = response.errors.join(" ");
          } else {
            reason = I18n.t("admin.groups.new.name.not_available");
          }

          this.set(validationName, this._failedInputValidation(reason));
        }
      })
      .catch(popupAjaxError);
  },

  _failedInputValidation(reason) {
    this.set("disableSave", true);

    const options = { failed: true };
    if (reason) {
      options.reason = reason;
    }
    this.set("basicNameValidation", EmberObject.create(options));
  },
});
