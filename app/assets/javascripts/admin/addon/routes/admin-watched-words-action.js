import EmberObject from "@ember/object";
import DiscourseRoute from "discourse/routes/discourse";
import I18n from "discourse-i18n";

export default class AdminWatchedWordsActionRoute extends DiscourseRoute {
  model(params) {
    const controller = this.controllerFor("adminWatchedWordsAction");
    controller.set("actionNameKey", params.action_id);
    return EmberObject.create({
      nameKey: params.action_id,
      name: I18n.t("admin.watched_words.actions." + params.action_id),
      words: controller.filteredContent,
    });
  }
}
