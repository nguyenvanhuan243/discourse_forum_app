import { service } from "@ember/service";
import DiscourseRoute from "discourse/routes/discourse";
import I18n from "discourse-i18n";

export default DiscourseRoute.extend({
  router: service(),

  titleToken() {
    return I18n.t("groups.manage.title");
  },

  model() {
    return this.modelFor("group");
  },

  afterModel(group) {
    if (
      !this.currentUser ||
      (!(this.modelFor("group").can_admin_group && group.get("automatic")) &&
        !this.currentUser.canManageGroup(group))
    ) {
      this.router.transitionTo("group.members", group);
    }
  },

  setupController(controller, model) {
    this.controllerFor("group-manage").setProperties({ model });
    this.controllerFor("group").set("showing", "manage");
  },
});
