import Controller, { inject as controller } from "@ember/controller";
import { service } from "@ember/service";

export default Controller.extend({
  router: service(),
  tagGroups: controller(),

  actions: {
    onDestroy() {
      const tagGroups = this.tagGroups.model;
      tagGroups.removeObject(this.model);

      this.router.transitionTo("tagGroups.index");
    },
  },
});
