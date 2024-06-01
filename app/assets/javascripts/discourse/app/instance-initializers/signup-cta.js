import Session from "discourse/models/session";

const ANON_TOPIC_IDS = 2;
const ANON_PROMPT_READ_TIME = 2 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const PROMPT_HIDE_DURATION = ONE_DAY;

export default {
  initialize(owner) {
    const screenTrack = owner.lookup("service:screen-track");
    const session = Session.current();
    const siteSettings = owner.lookup("service:site-settings");
    const keyValueStore = owner.lookup("service:key-value-store");
    const user = owner.lookup("service:current-user");
    const appEvents = owner.lookup("service:app-events");

    // Preconditions
    if (user) {
      return;
    } // must not be logged in
    if (keyValueStore.get("anon-cta-never")) {
      return;
    } // "never show again"
    if (!siteSettings.allow_new_registrations) {
      return;
    }
    if (siteSettings.invite_only) {
      return;
    }
    if (siteSettings.login_required) {
      return;
    }
    if (!siteSettings.enable_signup_cta) {
      return;
    }

    function checkSignupCtaRequirements() {
      if (session.get("showSignupCta")) {
        return; // already shown
      }

      if (session.get("hideSignupCta")) {
        return; // hidden for session
      }

      if (keyValueStore.get("anon-cta-never")) {
        return; // hidden forever
      }

      const now = Date.now();
      const hiddenAt = keyValueStore.getInt("anon-cta-hidden", 0);
      if (hiddenAt > now - PROMPT_HIDE_DURATION) {
        return; // hidden in last 24 hours
      }

      const readTime = keyValueStore.getInt("anon-topic-time");
      if (readTime < ANON_PROMPT_READ_TIME) {
        return;
      }

      const topicIdsString = keyValueStore.get("anon-topic-ids");
      if (!topicIdsString) {
        return;
      }
      let topicIdsAry = topicIdsString.split(",");
      if (topicIdsAry.length < ANON_TOPIC_IDS) {
        return;
      }

      // Requirements met.
      session.set("showSignupCta", true);
      appEvents.trigger("cta:shown");
    }

    screenTrack.registerAnonCallback(checkSignupCtaRequirements);

    checkSignupCtaRequirements();
  },
};
