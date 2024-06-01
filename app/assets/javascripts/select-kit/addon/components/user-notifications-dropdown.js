import { computed } from "@ember/object";
import { service } from "@ember/service";
import IgnoreDurationModal from "discourse/components/modal/ignore-duration-with-username";
import { popupAjaxError } from "discourse/lib/ajax-error";
import I18n from "discourse-i18n";
import DropdownSelectBox from "select-kit/components/dropdown-select-box";

export default DropdownSelectBox.extend({
  modal: service(),

  classNames: ["user-notifications", "user-notifications-dropdown"],

  selectKitOptions: {
    headerIcon: "userNotificationIcon",
    showCaret: true,
  },

  userNotificationIcon: computed("mainCollection.[]", "value", function () {
    return (
      this.mainCollection &&
      this.mainCollection.find((row) => row.id === this.value).icon
    );
  }),

  content: computed(function () {
    const content = [];

    content.push({
      icon: "bell",
      id: "changeToNormal",
      description: I18n.t("user.user_notifications.normal_option_title"),
      name: I18n.t("user.user_notifications.normal_option"),
    });

    content.push({
      icon: "bell-slash",
      id: "changeToMuted",
      description: I18n.t("user.user_notifications.mute_option_title"),
      name: I18n.t("user.user_notifications.mute_option"),
    });

    if (this.get("user.can_ignore_user")) {
      content.push({
        icon: "far-eye-slash",
        id: "changeToIgnored",
        description: I18n.t("user.user_notifications.ignore_option_title"),
        name: I18n.t("user.user_notifications.ignore_option"),
      });
    }

    return content;
  }),

  changeToNormal() {
    this.updateNotificationLevel({ level: "normal" }).catch(popupAjaxError);
  },
  changeToMuted() {
    this.updateNotificationLevel({ level: "mute" }).catch(popupAjaxError);
  },
  changeToIgnored() {
    this.modal.show(IgnoreDurationModal, {
      model: {
        ignoredUsername: this.user.username,
        enableSelection: false,
      },
    });
  },

  actions: {
    onChange(level) {
      this[level]();

      // hack but model.ignored/muted is not
      // getting updated after updateNotificationLevel
      this.set("value", level);
    },
  },
});
