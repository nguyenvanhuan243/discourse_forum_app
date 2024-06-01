import BaseSectionLink from "discourse/lib/sidebar/base-community-section-link";
import I18n from "discourse-i18n";

export default class ReviewSectionLink extends BaseSectionLink {
  get shouldDisplay() {
    return !!this.currentUser?.can_review;
  }

  get name() {
    return "review";
  }

  get route() {
    return "review";
  }

  get title() {
    return I18n.t("sidebar.sections.community.links.review.title");
  }

  get text() {
    return I18n.t(
      `sidebar.sections.community.links.${this.overridenName.toLowerCase()}.content`,
      { defaultValue: this.overridenName }
    );
  }

  get badgeText() {
    // force a tracker for reviewable_count by using .get to ensure badgeText
    // rerenders when reviewable_count changes
    if (this.currentUser?.get("reviewable_count") > 0) {
      return I18n.t("sidebar.sections.community.links.review.pending_count", {
        count: this.currentUser.reviewable_count,
      });
    }
  }

  get defaultPrefixValue() {
    return "flag";
  }
}
