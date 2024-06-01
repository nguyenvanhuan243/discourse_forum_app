import Controller from "@ember/controller";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export function popupAutomaticMembershipAlert(group_id, email_domains) {
  if (!email_domains) {
    return;
  }

  const data = {};
  data.automatic_membership_email_domains = email_domains;

  if (group_id) {
    data.id = group_id;
  }

  ajax(`/admin/groups/automatic_membership_count.json`, {
    type: "PUT",
    data,
  }).then((result) => {
    const count = result.user_count;

    if (count > 0) {
      this.dialog.alert(
        I18n.t(
          "admin.groups.manage.membership.automatic_membership_user_count",
          { count }
        )
      );
    }
  });
}

export default Controller.extend({
  dialog: service(),
  router: service(),
  saving: null,

  @discourseComputed("model.ownerUsernames")
  splitOwnerUsernames(owners) {
    return owners && owners.length ? owners.split(",") : [];
  },

  @discourseComputed("model.usernames")
  splitUsernames(usernames) {
    return usernames && usernames.length ? usernames.split(",") : [];
  },

  @action
  save() {
    this.set("saving", true);
    const group = this.model;

    popupAutomaticMembershipAlert(
      group.id,
      group.automatic_membership_email_domains
    );

    group
      .create()
      .then(() => {
        this.router.transitionTo("group.members", group.name);
      })
      .catch(popupAjaxError)
      .finally(() => this.set("saving", false));
  },

  @action
  updateOwnerUsernames(selected) {
    this.set("model.ownerUsernames", selected.join(","));
  },

  @action
  updateUsernames(selected) {
    this.set("model.usernames", selected.join(","));
  },
});
