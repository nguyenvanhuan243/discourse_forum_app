import EmberObject from "@ember/object";
import Mixin from "@ember/object/mixin";
import { isEmpty } from "@ember/utils";
import { setting } from "discourse/lib/computed";
import User from "discourse/models/user";
import discourseDebounce from "discourse-common/lib/debounce";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

function failedResult(attrs) {
  return EmberObject.create({
    shouldCheck: false,
    failed: true,
    ok: false,
    element: document.querySelector("#new-account-username"),
    ...attrs,
  });
}

function validResult(attrs) {
  return EmberObject.create({ ok: true, ...attrs });
}

export default Mixin.create({
  checkedUsername: null,
  usernameValidationResult: null,
  uniqueUsernameValidation: null,
  maxUsernameLength: setting("max_username_length"),
  minUsernameLength: setting("min_username_length"),

  async fetchExistingUsername() {
    const result = await User.checkUsername(null, this.accountEmail);

    if (
      result.suggestion &&
      (isEmpty(this.accountUsername) ||
        this.accountUsername === this.get("authOptions.username"))
    ) {
      this.setProperties({
        accountUsername: result.suggestion,
        prefilledUsername: result.suggestion,
      });
    }
  },

  @discourseComputed(
    "usernameValidationResult",
    "accountUsername",
    "forceValidationReason"
  )
  usernameValidation() {
    if (
      this.usernameValidationResult &&
      this.checkedUsername === this.accountUsername
    ) {
      return this.usernameValidationResult;
    }

    const result = this.basicUsernameValidation(this.accountUsername);

    if (result.shouldCheck) {
      discourseDebounce(this, this.checkUsernameAvailability, 500);
    }

    return result;
  },

  basicUsernameValidation(username) {
    if (username && username === this.prefilledUsername) {
      return validResult({ reason: I18n.t("user.username.prefilled") });
    }

    if (isEmpty(username)) {
      return failedResult({
        message: I18n.t("user.username.required"),
        reason: this.forceValidationReason
          ? I18n.t("user.username.required")
          : null,
      });
    }

    if (username.length < this.siteSettings.min_username_length) {
      return failedResult({ reason: I18n.t("user.username.too_short") });
    }

    if (username.length > this.maxUsernameLength) {
      return failedResult({ reason: I18n.t("user.username.too_long") });
    }

    return failedResult({
      shouldCheck: true,
      reason: I18n.t("user.username.checking"),
    });
  },

  async checkUsernameAvailability() {
    const result = await User.checkUsername(
      this.accountUsername,
      this.accountEmail
    );

    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    this.set("checkedUsername", this.accountUsername);
    this.set("isDeveloper", !!result.is_developer);

    if (result.available) {
      this.set(
        "usernameValidationResult",
        validResult({ reason: I18n.t("user.username.available") })
      );
    } else if (result.suggestion) {
      this.set(
        "usernameValidationResult",
        failedResult({
          reason: I18n.t("user.username.not_available", result),
        })
      );
    } else {
      this.set(
        "usernameValidationResult",
        failedResult({
          reason: result.errors
            ? result.errors.join(" ")
            : I18n.t("user.username.not_available_no_suggestion"),
        })
      );
    }
  },
});
