import { service } from "@ember/service";
import DiscourseRoute from "discourse/routes/discourse";
import I18n from "discourse-i18n";

export default DiscourseRoute.extend({
  router: service(),

  beforeModel() {
    if (!this.siteSettings.tagging_enabled) {
      this.router.transitionTo("tagGroups");
    }
  },

  model() {
    return this.store.createRecord("tagGroup", {
      name: I18n.t("tagging.groups.new_name"),
    });
  },
});
