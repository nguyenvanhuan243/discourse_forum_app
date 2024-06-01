import { service } from "@ember/service";
import DiscourseRoute from "discourse/routes/discourse";
import I18n from "discourse-i18n";

export default DiscourseRoute.extend({
  router: service(),

  titleToken() {
    return I18n.t("groups.manage.membership.title");
  },

  afterModel(group) {
    if (group.get("automatic")) {
      this.router.replaceWith("group.manage.interaction", group);
    }
  },
});
