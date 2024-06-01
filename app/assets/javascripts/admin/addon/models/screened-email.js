import EmberObject from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default class ScreenedEmail extends EmberObject {
  static findAll() {
    return ajax("/admin/logs/screened_emails.json").then(function (
      screened_emails
    ) {
      return screened_emails.map(function (b) {
        return ScreenedEmail.create(b);
      });
    });
  }

  @discourseComputed("action")
  actionName(action) {
    return I18n.t("admin.logs.screened_actions." + action);
  }

  clearBlock() {
    return ajax("/admin/logs/screened_emails/" + this.id, {
      type: "DELETE",
    });
  }
}
