import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { service } from "@ember/service";
import DiscourseURL from "discourse/lib/url";
import { bind } from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default class MergeUsersProgress extends Component {
  @service messageBus;

  @tracked message = I18n.t("admin.user.merging_user");

  constructor() {
    super(...arguments);
    this.messageBus.subscribe("/merge_user", this.onMessage);
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.messageBus.unsubscribe("/merge_user", this.onMessage);
  }

  @bind
  onMessage(data) {
    if (data.merged) {
      if (/^\/admin\/users\/list\//.test(location.href)) {
        DiscourseURL.redirectTo(location.href);
      } else {
        DiscourseURL.redirectTo(
          `/admin/users/${data.user.id}/${data.user.username}`
        );
      }
    } else if (data.message) {
      this.message = data.message;
    } else if (data.failed) {
      this.message = I18n.t("admin.user.merge_failed");
    }
  }
}
