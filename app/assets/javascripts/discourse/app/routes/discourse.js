import Route from "@ember/routing/route";
import { once } from "@ember/runloop";
import { service } from "@ember/service";
import { seenUser } from "discourse/lib/user-presence";
import deprecated from "discourse-common/lib/deprecated";
import { getOwnerWithFallback } from "discourse-common/lib/get-owner";

const DiscourseRoute = Route.extend({
  router: service(),

  willTransition() {
    seenUser();
  },

  _refreshTitleOnce() {
    this.send("_collectTitleTokens", []);
  },

  actions: {
    _collectTitleTokens(tokens) {
      // If there's a title token method, call it and get the token
      if (this.titleToken) {
        const t = this.titleToken();
        if (t && t.length) {
          if (t instanceof Array) {
            t.forEach(function (ti) {
              tokens.push(ti);
            });
          } else {
            tokens.push(t);
          }
        }
      }
      return true;
    },

    refreshTitle() {
      once(this, this._refreshTitleOnce);
    },
  },

  redirectIfLoginRequired() {
    const app = this.controllerFor("application");
    if (app.get("loginRequired")) {
      this.router.replaceWith("login");
    }
  },

  openTopicDraft() {
    deprecated(
      "DiscourseRoute#openTopicDraft is deprecated. Inject the composer service and call openNewTopic instead",
      { id: "discourse.open-topic-draft" }
    );
    if (this.currentUser?.has_topic_draft) {
      return getOwnerWithFallback(this)
        .lookup("service:composer")
        .openNewTopic({ preferDraft: true });
    }
  },

  isCurrentUser(user) {
    if (!this.currentUser) {
      return false; // the current user is anonymous
    }

    return user.id === this.currentUser.id;
  },
});

export default DiscourseRoute;
