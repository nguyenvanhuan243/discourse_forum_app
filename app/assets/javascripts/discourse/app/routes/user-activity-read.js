import { action } from "@ember/object";
import { htmlSafe } from "@ember/template";
import UserAction from "discourse/models/user-action";
import UserTopicListRoute from "discourse/routes/user-topic-list";
import getURL from "discourse-common/lib/get-url";
import { iconHTML } from "discourse-common/lib/icon-library";
import I18n from "discourse-i18n";

export default UserTopicListRoute.extend({
  userActionType: UserAction.TYPES.topics,

  model(params = {}) {
    return this.store
      .findFiltered("topicList", {
        filter: "read",
        params,
      })
      .then((model) => {
        // andrei: we agreed that this is an anti pattern,
        // it's better to avoid mutating a rest model like this
        // this place we'll be refactored later
        // see https://github.com/discourse/discourse/pull/14313#discussion_r708784704
        model.set("emptyState", this.emptyState());
        return model;
      });
  },

  emptyState() {
    const title = I18n.t("user_activity.no_read_topics_title");
    const body = htmlSafe(
      I18n.t("user_activity.no_read_topics_body", {
        topUrl: getURL("/top"),
        categoriesUrl: getURL("/categories"),
        searchIcon: iconHTML("search"),
      })
    );
    return { title, body };
  },

  titleToken() {
    return `${I18n.t("user.read")}`;
  },

  @action
  triggerRefresh() {
    this.refresh();
  },
});
