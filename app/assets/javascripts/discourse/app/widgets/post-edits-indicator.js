import { longDate } from "discourse/lib/formatter";
import { createWidget } from "discourse/widgets/widget";
import I18n from "discourse-i18n";

function mult(val) {
  return 60 * 50 * 1000 * val;
}

export function historyHeat(siteSettings, updatedAt) {
  if (!updatedAt) {
    return;
  }

  // Show heat on age
  const rightNow = Date.now();
  const updatedAtTime = updatedAt.getTime();

  if (updatedAtTime > rightNow - mult(siteSettings.history_hours_low)) {
    return "heatmap-high";
  }

  if (updatedAtTime > rightNow - mult(siteSettings.history_hours_medium)) {
    return "heatmap-med";
  }

  if (updatedAtTime > rightNow - mult(siteSettings.history_hours_high)) {
    return "heatmap-low";
  }
}

export default createWidget("post-edits-indicator", {
  tagName: "div.post-info.edits",

  html(attrs) {
    let icon = "pencil-alt";
    const updatedAt = new Date(attrs.updated_at);
    let className = historyHeat(this.siteSettings, updatedAt);
    const date = longDate(updatedAt);
    let title;

    if (attrs.wiki) {
      icon = "far-edit";
      className = `${className || ""} wiki`.trim();

      if (attrs.version > 1) {
        title = I18n.t("post.wiki_last_edited_on", { dateTime: date });
      } else {
        title = I18n.t("post.wiki.about");
      }
    } else {
      title = I18n.t("post.last_edited_on", { dateTime: date });
    }

    return this.attach("flat-button", {
      icon,
      translatedTitle: title,
      className,
      action: "onPostEditsIndicatorClick",
      translatedAriaLabel: I18n.t("post.edit_history"),
      translatedLabel: attrs.version > 1 ? attrs.version - 1 : "",
    });
  },

  onPostEditsIndicatorClick() {
    if (this.attrs.wiki && this.attrs.version === 1) {
      this.sendWidgetAction("editPost");
    } else if (this.attrs.canViewEditHistory) {
      this.sendWidgetAction("showHistory");
    }
  },
});
