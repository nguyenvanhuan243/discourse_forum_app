import EmberObject from "@ember/object";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default EmberObject.extend({
  showDefault: null,

  @discourseComputed("defaultIcon")
  renderDiv(defaultIcon) {
    return (defaultIcon || this.statuses.length > 0) && !this.noDiv;
  },

  @discourseComputed
  statuses() {
    const topic = this.topic;
    const results = [];

    // TODO, custom statuses? via override?
    if (topic.is_warning) {
      results.push({ icon: "envelope", key: "warning" });
    }

    if (topic.bookmarked) {
      const postNumbers = topic.bookmarked_post_numbers;
      let url = topic.url;
      let extraClasses = "";
      if (postNumbers && postNumbers[0] > 1) {
        url += "/" + postNumbers[0];
      } else {
        extraClasses = "op-bookmark";
      }

      results.push({
        extraClasses,
        icon: "bookmark",
        key: "bookmarked",
        href: url,
      });
    }

    if (topic.closed && topic.archived) {
      results.push({ icon: "lock", key: "locked_and_archived" });
    } else if (topic.closed) {
      results.push({ icon: "lock", key: "locked" });
    } else if (topic.archived) {
      results.push({ icon: "lock", key: "archived" });
    }

    if (topic.pinned) {
      results.push({ icon: "thumbtack", key: "pinned" });
    }

    if (topic.unpinned) {
      results.push({ icon: "thumbtack", key: "unpinned" });
    }

    if (topic.invisible) {
      results.push({ icon: "far-eye-slash", key: "unlisted" });
    }

    if (
      this.showPrivateMessageIcon &&
      topic.isPrivateMessage &&
      !topic.is_warning
    ) {
      results.push({ icon: "envelope", key: "personal_message" });
    }

    results.forEach((result) => {
      const translationParams = {};

      if (result.key === "unlisted") {
        translationParams.unlistedReason = topic.visibilityReasonTranslated;
      }

      result.title = I18n.t(
        `topic_statuses.${result.key}.help`,
        translationParams
      );

      if (
        this.currentUser &&
        (result.key === "pinned" || result.key === "unpinned")
      ) {
        result.openTag = "a href";
        result.closeTag = "a";
      } else {
        result.openTag = "span";
        result.closeTag = "span";
      }
    });

    let defaultIcon = this.defaultIcon;
    if (results.length === 0 && defaultIcon) {
      this.set("showDefault", defaultIcon);
    }
    return results;
  },
});
