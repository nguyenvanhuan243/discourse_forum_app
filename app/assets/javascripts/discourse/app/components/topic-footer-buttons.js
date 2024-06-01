import { getOwner } from "@ember/application";
import Component from "@ember/component";
import { computed } from "@ember/object";
import { alias, or } from "@ember/object/computed";
import { NotificationLevels } from "discourse/lib/notification-levels";
import { getTopicFooterButtons } from "discourse/lib/register-topic-footer-button";
import { getTopicFooterDropdowns } from "discourse/lib/register-topic-footer-dropdown";
import TopicBookmarkManager from "discourse/lib/topic-bookmark-manager";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  elementId: "topic-footer-buttons",

  attributeBindings: ["role"],

  role: "region",

  @discourseComputed("canSendPms", "topic.isPrivateMessage")
  canArchive(canSendPms, isPM) {
    return canSendPms && isPM;
  },

  inlineButtons: getTopicFooterButtons(),
  inlineDropdowns: getTopicFooterDropdowns(),

  inlineActionables: computed(
    "inlineButtons.[]",
    "inlineDropdowns.[]",
    function () {
      return this.inlineButtons
        .filterBy("dropdown", false)
        .filterBy("anonymousOnly", false)
        .concat(this.inlineDropdowns)
        .sortBy("priority")
        .reverse();
    }
  ),

  topicBookmarkManager: computed("topic", function () {
    return new TopicBookmarkManager(getOwner(this), this.topic);
  }),

  // topic.assigned_to_user is for backward plugin support
  @discourseComputed("inlineButtons.[]", "topic.assigned_to_user")
  dropdownButtons(inlineButtons) {
    return inlineButtons.filter((button) => button.dropdown);
  },

  @discourseComputed("topic.isPrivateMessage")
  showNotificationsButton(isPM) {
    return !isPM || this.canSendPms;
  },

  @discourseComputed("topic.details.notification_level")
  showNotificationUserTip(notificationLevel) {
    return notificationLevel >= NotificationLevels.TRACKING;
  },

  canSendPms: alias("currentUser.can_send_private_messages"),

  canInviteTo: alias("topic.details.can_invite_to"),

  canDefer: alias("currentUser.user_option.enable_defer"),

  inviteDisabled: or("topic.archived", "topic.closed", "topic.deleted"),

  @discourseComputed("topic.message_archived")
  archiveIcon: (archived) => (archived ? "envelope" : "folder"),

  @discourseComputed("topic.message_archived")
  archiveTitle: (archived) =>
    archived ? "topic.move_to_inbox.help" : "topic.archive_message.help",

  @discourseComputed("topic.message_archived")
  archiveLabel: (archived) =>
    archived ? "topic.move_to_inbox.title" : "topic.archive_message.title",

  @discourseComputed("topic.isPrivateMessage")
  showBookmarkLabel: (isPM) => !isPM,
});
