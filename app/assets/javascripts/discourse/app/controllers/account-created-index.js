import Controller from "@ember/controller";
import { service } from "@ember/service";
import { resendActivationEmail } from "discourse/lib/user-activation";
import { wavingHandURL } from "discourse/lib/waving-hand-url";
import getUrl from "discourse-common/lib/get-url";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Controller.extend({
  router: service(),
  envelopeImageUrl: getUrl("/images/envelope.svg"),

  @discourseComputed
  welcomeTitle() {
    return I18n.t("invites.welcome_to", {
      site_name: this.siteSettings.title,
    });
  },

  @discourseComputed
  wavingHandURL: () => wavingHandURL(),

  actions: {
    sendActivationEmail() {
      resendActivationEmail(this.get("accountCreated.username")).then(() => {
        this.router.transitionTo("account-created.resent");
      });
    },
    editActivationEmail() {
      this.router.transitionTo("account-created.edit-email");
    },
  },
});
