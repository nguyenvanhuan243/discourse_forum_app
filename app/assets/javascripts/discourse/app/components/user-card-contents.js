import Component from "@ember/component";
import EmberObject, { action, set } from "@ember/object";
import { alias, and, gt, gte, not, or } from "@ember/object/computed";
import { dasherize } from "@ember/string";
import { isEmpty } from "@ember/utils";
import { propertyNotEqual, setting } from "discourse/lib/computed";
import { durationTiny } from "discourse/lib/formatter";
import { prioritizeNameInUx } from "discourse/lib/settings";
import { emojiUnescape } from "discourse/lib/text";
import { escapeExpression, modKeysPressed } from "discourse/lib/utilities";
import CanCheckEmails from "discourse/mixins/can-check-emails";
import CardContentsBase from "discourse/mixins/card-contents-base";
import CleansUp from "discourse/mixins/cleans-up";
import User from "discourse/models/user";
import { getURLWithCDN } from "discourse-common/lib/get-url";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default Component.extend(CardContentsBase, CanCheckEmails, CleansUp, {
  elementId: "user-card",
  classNames: "user-card",
  avatarSelector: "[data-user-card]",
  avatarDataAttrKey: "userCard",
  mentionSelector: "a.mention",
  classNameBindings: [
    "visible:show",
    "showBadges",
    "user.card_background_upload_url::no-bg",
    "isFixed:fixed",
    "usernameClass",
    "primaryGroup",
  ],
  attributeBindings: ["labelledBy:aria-labelledby"],
  allowBackgrounds: setting("allow_profile_backgrounds"),
  showBadges: setting("enable_badges"),

  postStream: alias("topic.postStream"),
  enoughPostsForFiltering: gte("topicPostCount", 2),
  showFilter: and(
    "viewingTopic",
    "postStream.hasNoFilters",
    "enoughPostsForFiltering"
  ),
  showName: propertyNotEqual("user.name", "user.username"),
  hasUserFilters: gt("postStream.userFilters.length", 0),
  showMoreBadges: gt("moreBadgesCount", 0),
  showDelete: and("viewingAdmin", "showName", "user.canBeDeleted"),
  linkWebsite: not("user.isBasic"),

  @discourseComputed("user")
  labelledBy(user) {
    return user ? "discourse-user-card-title" : null;
  },

  @discourseComputed("user")
  hasLocaleOrWebsite(user) {
    return user.location || user.website_name || this.userTimezone;
  },

  @discourseComputed("user.status")
  hasStatus() {
    return this.siteSettings.enable_user_status && this.user.status;
  },

  @discourseComputed("user.status.emoji")
  userStatusEmoji(emoji) {
    return emojiUnescape(escapeExpression(`:${emoji}:`));
  },

  isSuspendedOrHasBio: or("user.suspend_reason", "user.bio_excerpt"),
  showCheckEmail: and("user.staged", "canCheckEmails"),

  user: null,

  // If inside a topic
  topicPostCount: null,

  showFeaturedTopic: and(
    "user.featured_topic",
    "siteSettings.allow_featured_topic_on_user_profiles"
  ),

  showUserLocalTime: setting("display_local_time_in_user_card"),

  @discourseComputed("user.staff")
  staff: (isStaff) => (isStaff ? "staff" : ""),

  @discourseComputed("user.trust_level")
  newUser: (trustLevel) => (trustLevel === 0 ? "new-user" : ""),

  @discourseComputed("user.name")
  nameFirst(name) {
    return prioritizeNameInUx(name);
  },

  @discourseComputed("user")
  userTimezone(user) {
    if (!this.showUserLocalTime) {
      return;
    }
    return user.get("user_option.timezone");
  },

  @discourseComputed("userTimezone")
  formattedUserLocalTime(timezone) {
    return moment.tz(timezone).format(I18n.t("dates.time"));
  },

  @discourseComputed("username")
  usernameClass: (username) => (username ? `user-card-${username}` : ""),

  @discourseComputed("username", "topicPostCount")
  filterPostsLabel(username, count) {
    return I18n.t("topic.filter_to", { username, count });
  },

  @discourseComputed("user.user_fields.@each.value")
  publicUserFields() {
    const siteUserFields = this.site.get("user_fields");
    if (!isEmpty(siteUserFields)) {
      const userFields = this.get("user.user_fields");
      return siteUserFields
        .filterBy("show_on_user_card", true)
        .sortBy("position")
        .map((field) => {
          set(field, "dasherized_name", dasherize(field.get("name")));
          const value = userFields ? userFields[field.get("id")] : null;
          return isEmpty(value) ? null : EmberObject.create({ value, field });
        })
        .compact();
    }
  },

  @discourseComputed("user.trust_level")
  removeNoFollow(trustLevel) {
    return trustLevel > 2 && !this.siteSettings.tl3_links_no_follow;
  },

  @discourseComputed("user.badge_count", "user.featured_user_badges.length")
  moreBadgesCount: (badgeCount, badgeLength) => badgeCount - badgeLength,

  @discourseComputed("user.time_read", "user.recent_time_read")
  showRecentTimeRead(timeRead, recentTimeRead) {
    return timeRead !== recentTimeRead && recentTimeRead !== 0;
  },

  @discourseComputed("user.recent_time_read")
  recentTimeRead(recentTimeReadSeconds) {
    return durationTiny(recentTimeReadSeconds);
  },

  @discourseComputed("showRecentTimeRead", "user.time_read", "recentTimeRead")
  timeReadTooltip(showRecent, timeRead, recentTimeRead) {
    if (showRecent) {
      return I18n.t("time_read_recently_tooltip", {
        time_read: durationTiny(timeRead),
        recent_time_read: recentTimeRead,
      });
    } else {
      return I18n.t("time_read_tooltip", {
        time_read: durationTiny(timeRead),
      });
    }
  },

  @observes("user.card_background_upload_url")
  addBackground() {
    if (!this.allowBackgrounds) {
      return;
    }

    const thisElem = this.element;
    if (!thisElem) {
      return;
    }

    const url = this.get("user.card_background_upload_url");
    const bg = isEmpty(url) ? "" : `url(${getURLWithCDN(url)})`;
    thisElem.style.backgroundImage = bg;
  },

  @discourseComputed("user.primary_group_name")
  primaryGroup(primaryGroup) {
    return `group-${primaryGroup}`;
  },

  @discourseComputed("user.profile_hidden", "user.inactive")
  contentHidden(profileHidden, inactive) {
    return profileHidden || inactive;
  },

  _showCallback(username, $target) {
    this._positionCard($target);
    this.setProperties({ visible: true, loading: true });

    const args = {
      forCard: true,
      include_post_count_for: this.get("topic.id"),
    };

    return User.findByUsername(username, args)
      .then((user) => {
        if (user.topic_post_count) {
          this.set(
            "topicPostCount",
            user.topic_post_count[args.include_post_count_for]
          );
        }
        this.setProperties({ user });
        this.user.statusManager.trackStatus();
        return user;
      })
      .catch(() => this._close())
      .finally(() => this.set("loading", null));
  },

  _close() {
    if (this.user) {
      this.user.statusManager.stopTrackingStatus();
    }

    this.setProperties({
      user: null,
      topicPostCount: null,
    });

    this._super(...arguments);
  },

  cleanUp() {
    this._close();
  },

  @action
  handleShowUser(user, event) {
    if (event && modKeysPressed(event).length > 0) {
      return false;
    }
    event?.preventDefault();
    // Invokes `showUser` argument. Convert to `this.args.showUser` when
    // refactoring this to a glimmer component.
    this.showUser(user);
    this._close();
  },

  actions: {
    close() {
      this._close();
    },

    composePM(user, post) {
      this._close();
      this.composePrivateMessage(user, post);
    },

    cancelFilter() {
      const postStream = this.postStream;
      postStream.cancelFilter();
      postStream.refresh();
      this._close();
    },

    filterPosts() {
      this.filterPosts(this.user);
      this._close();
    },

    deleteUser() {
      this.user.delete();
      this._close();
    },

    showUser(user) {
      this.handleShowUser(user);
    },

    checkEmail(user) {
      user.checkEmail();
    },
  },
});
