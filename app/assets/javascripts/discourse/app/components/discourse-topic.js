import { getOwner } from "@ember/application";
import Component from "@ember/component";
import { alias } from "@ember/object/computed";
import { schedule, scheduleOnce, throttle } from "@ember/runloop";
import { service } from "@ember/service";
import { isBlank } from "@ember/utils";
import $ from "jquery";
import ClickTrack from "discourse/lib/click-track";
import DiscourseURL from "discourse/lib/url";
import { highlightPost } from "discourse/lib/utilities";
import MobileScrollDirection from "discourse/mixins/mobile-scroll-direction";
import Scrolling from "discourse/mixins/scrolling";
import discourseLater from "discourse-common/lib/later";
import { bind, observes } from "discourse-common/utils/decorators";

const MOBILE_SCROLL_DIRECTION_CHECK_THROTTLE = 300;

export default Component.extend(Scrolling, MobileScrollDirection, {
  userFilters: alias("topic.userFilters"),
  classNameBindings: [
    "multiSelect",
    "topic.archetype",
    "topic.is_warning",
    "topic.category.read_restricted:read_restricted",
    "topic.deleted:deleted-topic",
  ],
  header: service(),
  menuVisible: true,
  SHORT_POST: 1200,

  postStream: alias("topic.postStream"),
  dockAt: 0,

  _lastShowTopic: null,

  mobileScrollDirection: null,
  pauseHeaderTopicUpdate: false,

  @observes("enteredAt")
  _enteredTopic() {
    // Ember is supposed to only call observers when values change but something
    // in our view set up is firing this observer with the same value. This check
    // prevents scrolled from being called twice
    if (this.enteredAt && this.lastEnteredAt !== this.enteredAt) {
      this._lastShowTopic = null;
      schedule("afterRender", this.scrolled);
      this.set("lastEnteredAt", this.enteredAt);
    }
  },

  _highlightPost(postNumber, options = {}) {
    if (isBlank(options.jump) || options.jump !== false) {
      scheduleOnce("afterRender", null, highlightPost, postNumber);
    }
  },

  _hideTopicInHeader() {
    this.appEvents.trigger("header:hide-topic");
    this.header.topic = null;
    this._lastShowTopic = false;
  },

  _showTopicInHeader(topic) {
    if (this.pauseHeaderTopicUpdate) {
      return;
    }
    this.appEvents.trigger("header:show-topic", topic);
    this.header.topic = topic;
    this._lastShowTopic = true;
  },

  _updateTopic(topic, debounceDuration) {
    if (topic === null) {
      this._hideTopicInHeader();

      if (debounceDuration && !this.pauseHeaderTopicUpdate) {
        this.pauseHeaderTopicUpdate = true;
        this._lastShowTopic = true;

        discourseLater(() => {
          this._lastShowTopic = false;
          this.pauseHeaderTopicUpdate = false;
        }, debounceDuration);
      }

      return;
    }

    const offset = window.pageYOffset || document.documentElement.scrollTop;
    this._lastShowTopic = this.shouldShowTopicInHeader(topic, offset);

    if (this._lastShowTopic) {
      this._showTopicInHeader(topic);
    } else {
      this._hideTopicInHeader();
    }
  },

  init() {
    this._super(...arguments);
    this.appEvents.on("discourse:focus-changed", this, "gotFocus");
    this.appEvents.on("post:highlight", this, "_highlightPost");
    this.appEvents.on("header:update-topic", this, "_updateTopic");
  },

  didInsertElement() {
    this._super(...arguments);

    this.bindScrolling();
    window.addEventListener("resize", this.scrolled);
    $(this.element).on(
      "click.discourse-redirect",
      ".cooked a, a.track-link",
      (e) => ClickTrack.trackClick(e, getOwner(this))
    );
  },

  willDestroy() {
    this._super(...arguments);

    // this happens after route exit, stuff could have trickled in
    this._hideTopicInHeader();
    this.appEvents.off("discourse:focus-changed", this, "gotFocus");
    this.appEvents.off("post:highlight", this, "_highlightPost");
    this.appEvents.off("header:update-topic", this, "_updateTopic");
  },

  willDestroyElement() {
    this._super(...arguments);

    this.unbindScrolling();
    window.removeEventListener("resize", this.scrolled);

    // Unbind link tracking
    $(this.element).off("click.discourse-redirect", ".cooked a, a.track-link");

    this.resetExamineDockCache();
  },

  gotFocus(hasFocus) {
    if (hasFocus) {
      this.scrolled();
    }
  },

  resetExamineDockCache() {
    this.set("dockAt", 0);
  },

  shouldShowTopicInHeader(topic, offset) {
    // On mobile, we show the header topic if the user has scrolled past the topic
    // title and the current scroll direction is down
    // On desktop the user only needs to scroll past the topic title.
    return (
      offset > this.dockAt &&
      (this.site.desktopView || this.mobileScrollDirection === "down")
    );
  },

  // The user has scrolled the window, or it is finished rendering and ready for processing.
  @bind
  scrolled() {
    if (this.isDestroyed || this.isDestroying || this._state !== "inDOM") {
      return;
    }

    const offset = window.pageYOffset || document.documentElement.scrollTop;
    if (this.dockAt === 0) {
      const title = document.querySelector("#topic-title");
      if (title) {
        this.set("dockAt", title.getBoundingClientRect().top + window.scrollY);
      }
    }

    this.set("hasScrolled", offset > 0);

    const showTopic = this.shouldShowTopicInHeader(this.topic, offset);

    if (showTopic !== this._lastShowTopic) {
      if (showTopic) {
        this._showTopicInHeader(this.topic);
      } else {
        if (!DiscourseURL.isJumpScheduled()) {
          const loadingNear = this.topic.get("postStream.loadingNearPost") || 1;
          if (loadingNear === 1) {
            this._hideTopicInHeader();
          }
        }
      }
    }

    // Since the user has scrolled, we need to check the scroll direction on mobile.
    // We use throttle instead of debounce because we want the switch to occur
    // at the start of the scroll. This feels a lot more snappy compared to waiting
    // for the scroll to end if we debounce.
    if (this.site.mobileView && this.hasScrolled) {
      throttle(
        this,
        this.calculateDirection,
        offset,
        MOBILE_SCROLL_DIRECTION_CHECK_THROTTLE
      );
    }

    // Trigger a scrolled event
    this.appEvents.trigger("topic:scrolled", offset);
  },

  // We observe the scroll direction on mobile and if it's down, we show the topic
  // in the header, otherwise, we hide it.
  @observes("mobileScrollDirection")
  toggleMobileHeaderTopic() {
    return this.appEvents.trigger(
      "header:update-topic",
      this.mobileScrollDirection === "down" ? this.topic : null
    );
  },
});
