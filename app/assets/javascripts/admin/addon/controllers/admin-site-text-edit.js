import Controller from "@ember/controller";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { bufferedProperty } from "discourse/mixins/buffered-content";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Controller.extend(bufferedProperty("siteText"), {
  dialog: service(),
  saved: false,
  queryParams: ["locale"],

  @discourseComputed("buffered.value")
  saveDisabled(value) {
    return this.siteText.value === value;
  },

  @discourseComputed("siteText.status")
  isOutdated(status) {
    return status === "outdated";
  },

  @action
  saveChanges() {
    const attrs = this.buffered.getProperties("value");
    attrs.locale = this.locale;

    this.siteText
      .save(attrs)
      .then(() => {
        this.commitBuffer();
        this.set("saved", true);
      })
      .catch(popupAjaxError);
  },

  @action
  revertChanges() {
    this.set("saved", false);

    this.dialog.yesNoConfirm({
      message: I18n.t("admin.site_text.revert_confirm"),
      didConfirm: () => {
        this.siteText
          .revert(this.locale)
          .then((props) => {
            const buffered = this.buffered;
            buffered.setProperties(props);
            this.commitBuffer();
          })
          .catch(popupAjaxError);
      },
    });
  },

  @action
  dismissOutdated() {
    this.siteText
      .dismissOutdated(this.locale)
      .then(() => {
        this.siteText.set("status", "up_to_date");
      })
      .catch(popupAjaxError);
  },

  get interpolationKeys() {
    return this.siteText.interpolation_keys.join(", ");
  },
});
