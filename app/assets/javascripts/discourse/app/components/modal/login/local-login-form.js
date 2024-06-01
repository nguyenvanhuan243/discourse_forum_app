import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import { isEmpty } from "@ember/utils";
import ForgotPassword from "discourse/components/modal/forgot-password";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { escapeExpression } from "discourse/lib/utilities";
import { getWebauthnCredential } from "discourse/lib/webauthn";
import I18n from "discourse-i18n";

export default class LocalLoginBody extends Component {
  @service modal;

  @tracked maskPassword = true;
  @tracked processingEmailLink = false;
  @tracked capsLockOn = false;

  get credentialsClass() {
    return this.args.showSecondFactor || this.args.showSecurityKey
      ? "hidden"
      : "";
  }

  get secondFactorClass() {
    return this.args.showSecondFactor || this.args.showSecurityKey
      ? ""
      : "hidden";
  }

  get disableLoginFields() {
    return this.args.showSecondFactor || this.args.showSecurityKey;
  }

  @action
  passkeyConditionalLogin() {
    if (this.args.canUsePasskeys) {
      this.args.passkeyLogin("conditional");
    }
  }

  @action
  togglePasswordMask() {
    this.maskPassword = !this.maskPassword;
  }

  @action
  async emailLogin(event) {
    event?.preventDefault();

    if (this.processingEmailLink) {
      return;
    }

    if (isEmpty(this.args.loginName)) {
      this.args.flashChanged(I18n.t("login.blank_username"));
      this.args.flashTypeChanged("info");
      return;
    }

    try {
      this.processingEmailLink = true;
      const data = await ajax("/u/email-login", {
        data: { login: this.args.loginName.trim() },
        type: "POST",
      });
      const loginName = escapeExpression(this.args.loginName);
      const isEmail = loginName.match(/@/);
      const key = isEmail
        ? "email_login.complete_email"
        : "email_login.complete_username";
      if (data.user_found === false) {
        this.args.flashChanged(
          htmlSafe(
            I18n.t(`${key}_not_found`, {
              email: loginName,
              username: loginName,
            })
          )
        );
        this.args.flashTypeChanged("error");
      } else {
        const postfix = data.hide_taken ? "" : "_found";
        this.args.flashChanged(
          htmlSafe(
            I18n.t(`${key}${postfix}`, {
              email: loginName,
              username: loginName,
            })
          )
        );
        this.args.flashTypeChanged("success");
      }
    } catch (e) {
      popupAjaxError(e);
    } finally {
      this.processingEmailLink = false;
    }
  }

  @action
  loginOnEnter(event) {
    if (event.key === "Enter") {
      this.args.login();
    }
  }

  @action
  handleForgotPassword(event) {
    event?.preventDefault();

    this.modal.show(ForgotPassword, {
      model: {
        emailOrUsername: this.args.loginName,
      },
    });
  }

  @action
  authenticateSecurityKey() {
    getWebauthnCredential(
      this.args.securityKeyChallenge,
      this.args.securityKeyAllowedCredentialIds,
      (credentialData) => {
        this.args.securityKeyCredentialChanged(credentialData);
        this.args.login();
      },
      (error) => {
        this.args.flashChanged(error);
        this.args.flashTypeChanged("error");
      }
    );
  }
}
