import Controller from "@ember/controller";
import EmberObject, { action } from "@ember/object";
import { alias, bool, not, readOnly } from "@ember/object/computed";
import { isEmpty } from "@ember/utils";
import { ajax } from "discourse/lib/ajax";
import { extractError } from "discourse/lib/ajax-error";
import DiscourseURL from "discourse/lib/url";
import { emailValid } from "discourse/lib/utilities";
import { wavingHandURL } from "discourse/lib/waving-hand-url";
import NameValidation from "discourse/mixins/name-validation";
import PasswordValidation from "discourse/mixins/password-validation";
import UserFieldsValidation from "discourse/mixins/user-fields-validation";
import UsernameValidation from "discourse/mixins/username-validation";
import { findAll as findLoginMethods } from "discourse/models/login-method";
import getUrl from "discourse-common/lib/get-url";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Controller.extend(
  PasswordValidation,
  UsernameValidation,
  NameValidation,
  UserFieldsValidation,
  {
    queryParams: ["t"],

    invitedBy: readOnly("model.invited_by"),
    email: alias("model.email"),
    accountEmail: alias("email"),
    existingUserId: readOnly("model.existing_user_id"),
    existingUserCanRedeem: readOnly("model.existing_user_can_redeem"),
    existingUserCanRedeemError: readOnly(
      "model.existing_user_can_redeem_error"
    ),
    existingUserRedeeming: bool("existingUserId"),
    hiddenEmail: alias("model.hidden_email"),
    emailVerifiedByLink: alias("model.email_verified_by_link"),
    differentExternalEmail: alias("model.different_external_email"),
    accountUsername: alias("model.username"),
    passwordRequired: not("externalAuthsOnly"),
    successMessage: null,
    errorMessage: null,
    userFields: null,
    authOptions: null,
    inviteImageUrl: getUrl("/images/envelope.svg"),
    isInviteLink: readOnly("model.is_invite_link"),
    rejectedEmails: null,
    maskPassword: true,

    init() {
      this._super(...arguments);

      this.rejectedEmails = [];
    },

    authenticationComplete(options) {
      const props = {
        accountUsername: options.username,
        accountName: options.name,
        authOptions: EmberObject.create(options),
      };

      if (this.isInviteLink) {
        props.email = options.email;
      }

      this.setProperties(props);
    },

    @discourseComputed
    discourseConnectEnabled() {
      return this.siteSettings.enable_discourse_connect;
    },

    @discourseComputed
    welcomeTitle() {
      return I18n.t("invites.welcome_to", {
        site_name: this.siteSettings.title,
      });
    },

    @discourseComputed("existingUserId")
    subheaderMessage(existingUserId) {
      if (existingUserId) {
        return I18n.t("invites.existing_user_can_redeem");
      } else {
        return I18n.t("create_account.subheader_title");
      }
    },

    @discourseComputed("email")
    yourEmailMessage(email) {
      return I18n.t("invites.your_email", { email });
    },

    @discourseComputed
    externalAuthsEnabled() {
      return findLoginMethods().length > 0;
    },

    @discourseComputed
    externalAuthsOnly() {
      return (
        !this.siteSettings.enable_local_logins &&
        this.externalAuthsEnabled &&
        !this.siteSettings.enable_discourse_connect
      );
    },

    @discourseComputed(
      "emailValidation.failed",
      "usernameValidation.failed",
      "passwordValidation.failed",
      "nameValidation.failed",
      "userFieldsValidation.failed",
      "existingUserRedeeming",
      "existingUserCanRedeem"
    )
    submitDisabled(
      emailValidationFailed,
      usernameValidationFailed,
      passwordValidationFailed,
      nameValidationFailed,
      userFieldsValidationFailed,
      existingUserRedeeming,
      existingUserCanRedeem
    ) {
      if (existingUserRedeeming) {
        return !existingUserCanRedeem;
      }

      return (
        emailValidationFailed ||
        usernameValidationFailed ||
        passwordValidationFailed ||
        nameValidationFailed ||
        userFieldsValidationFailed
      );
    },

    @discourseComputed(
      "externalAuthsEnabled",
      "externalAuthsOnly",
      "discourseConnectEnabled"
    )
    showSocialLoginAvailable(
      externalAuthsEnabled,
      externalAuthsOnly,
      discourseConnectEnabled
    ) {
      return (
        externalAuthsEnabled && !externalAuthsOnly && !discourseConnectEnabled
      );
    },

    @discourseComputed(
      "externalAuthsOnly",
      "authOptions",
      "emailValidation.failed",
      "existingUserRedeeming"
    )
    shouldDisplayForm(
      externalAuthsOnly,
      authOptions,
      emailValidationFailed,
      existingUserRedeeming
    ) {
      return (
        (this.siteSettings.enable_local_logins ||
          (externalAuthsOnly && authOptions && !emailValidationFailed)) &&
        !this.siteSettings.enable_discourse_connect &&
        !existingUserRedeeming
      );
    },

    @discourseComputed
    fullnameRequired() {
      return (
        this.siteSettings.full_name_required || this.siteSettings.enable_names
      );
    },

    @discourseComputed(
      "email",
      "rejectedEmails.[]",
      "authOptions.email",
      "authOptions.email_valid",
      "hiddenEmail",
      "emailVerifiedByLink",
      "differentExternalEmail"
    )
    emailValidation(
      email,
      rejectedEmails,
      externalAuthEmail,
      externalAuthEmailValid,
      hiddenEmail,
      emailVerifiedByLink,
      differentExternalEmail
    ) {
      if (hiddenEmail && !differentExternalEmail) {
        return EmberObject.create({
          ok: true,
          reason: I18n.t("user.email.ok"),
        });
      }

      // If blank, fail without a reason
      if (isEmpty(email)) {
        return EmberObject.create({
          failed: true,
        });
      }

      if (rejectedEmails.includes(email)) {
        return EmberObject.create({
          failed: true,
          reason: I18n.t("user.email.invalid"),
        });
      }

      if (externalAuthEmail && externalAuthEmailValid) {
        const provider = this.authProviderDisplayName(
          this.get("authOptions.auth_provider")
        );

        if (externalAuthEmail === email) {
          return EmberObject.create({
            ok: true,
            reason: I18n.t("user.email.authenticated", {
              provider,
            }),
          });
        } else {
          return EmberObject.create({
            failed: true,
            reason: I18n.t("user.email.invite_auth_email_invalid", {
              provider,
            }),
          });
        }
      }

      if (emailVerifiedByLink) {
        return EmberObject.create({
          ok: true,
          reason: I18n.t("user.email.authenticated_by_invite"),
        });
      }

      if (emailValid(email)) {
        return EmberObject.create({
          ok: true,
          reason: I18n.t("user.email.ok"),
        });
      }

      return EmberObject.create({
        failed: true,
        reason: I18n.t("user.email.invalid"),
      });
    },

    authProviderDisplayName(providerName) {
      const matchingProvider = findLoginMethods().find((provider) => {
        return provider.name === providerName;
      });
      return matchingProvider
        ? matchingProvider.get("prettyName")
        : providerName;
    },

    @discourseComputed
    wavingHandURL: () => wavingHandURL(),

    @discourseComputed
    ssoPath: () => getUrl("/session/sso"),

    @discourseComputed
    disclaimerHtml() {
      if (this.site.tos_url && this.site.privacy_policy_url) {
        return I18n.t("create_account.disclaimer", {
          tos_link: this.site.tos_url,
          privacy_link: this.site.privacy_policy_url,
        });
      }
    },

    @discourseComputed("authOptions.associate_url", "authOptions.auth_provider")
    associateHtml(url, provider) {
      if (!url) {
        return;
      }
      return I18n.t("create_account.associate", {
        associate_link: url,
        provider: I18n.t(`login.${provider}.name`),
      });
    },

    @action
    togglePasswordMask() {
      this.toggleProperty("maskPassword");
    },

    actions: {
      submit() {
        const userFields = this.userFields;
        let userCustomFields = {};
        if (!isEmpty(userFields)) {
          userFields.forEach(function (f) {
            userCustomFields[f.get("field.id")] = f.get("value");
          });
        }

        const data = {
          username: this.accountUsername,
          name: this.accountName,
          password: this.accountPassword,
          user_custom_fields: userCustomFields,
          timezone: moment.tz.guess(),
        };

        if (this.isInviteLink) {
          data.email = this.email;
        } else {
          data.email_token = this.t;
        }

        ajax({
          url: `/invites/show/${this.get("model.token")}.json`,
          type: "PUT",
          data,
        })
          .then((result) => {
            if (result.success) {
              this.set(
                "successMessage",
                result.message || I18n.t("invites.success")
              );
              if (result.redirect_to) {
                DiscourseURL.redirectTo(result.redirect_to);
              }
            } else {
              if (
                result.errors &&
                result.errors.email &&
                result.errors.email.length > 0 &&
                result.values
              ) {
                this.rejectedEmails.pushObject(result.values.email);
              }
              if (
                result.errors &&
                result.errors.password &&
                result.errors.password.length > 0
              ) {
                this.rejectedPasswords.pushObject(this.accountPassword);
                this.rejectedPasswordsMessages.set(
                  this.accountPassword,
                  result.errors.password[0]
                );
              }
              if (result.message) {
                this.set("errorMessage", result.message);
              }
            }
          })
          .catch((error) => {
            this.set("errorMessage", extractError(error));
          });
      },

      externalLogin(provider) {
        provider.doLogin({
          signup: true,
          params: {
            origin: window.location.href,
          },
        });
      },
    },
  }
);
