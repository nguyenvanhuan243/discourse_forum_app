import Component from "@ember/component";
import { scheduleOnce } from "@ember/runloop";
import { service } from "@ember/service";
import $ from "jquery";
import DiscourseURL from "discourse/lib/url";
import CleansUp from "discourse/mixins/cleans-up";
import discourseComputed, { bind } from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

function entranceDate(dt, showTime) {
  const today = new Date();

  if (dt.toDateString() === today.toDateString()) {
    return moment(dt).format(I18n.t("dates.time"));
  }

  if (dt.getYear() === today.getYear()) {
    // No year
    return moment(dt).format(
      showTime
        ? I18n.t("dates.long_date_without_year_with_linebreak")
        : I18n.t("dates.long_no_year_no_time")
    );
  }

  return moment(dt).format(
    showTime
      ? I18n.t("dates.long_date_with_year_with_linebreak")
      : I18n.t("dates.long_date_with_year_without_time")
  );
}

export default Component.extend(CleansUp, {
  router: service(),
  session: service(),
  historyStore: service(),
  elementId: "topic-entrance",
  classNameBindings: ["visible::hidden"],
  topic: null,
  visible: null,
  _position: null,
  _originalActiveElement: null,
  _activeButton: null,

  @discourseComputed("topic.created_at")
  createdDate: (createdAt) => new Date(createdAt),

  @discourseComputed("topic.bumped_at")
  bumpedDate: (bumpedAt) => new Date(bumpedAt),

  @discourseComputed("createdDate", "bumpedDate")
  showTime(createdDate, bumpedDate) {
    return (
      bumpedDate.getTime() - createdDate.getTime() < 1000 * 60 * 60 * 24 * 2
    );
  },

  @discourseComputed("createdDate", "showTime")
  topDate: (createdDate, showTime) => entranceDate(createdDate, showTime),

  @discourseComputed("bumpedDate", "showTime")
  bottomDate: (bumpedDate, showTime) => entranceDate(bumpedDate, showTime),

  didInsertElement() {
    this._super(...arguments);
    this.appEvents.on("topic-entrance:show", this, "_show");
  },

  _setCSS() {
    const pos = this._position;
    const $self = $(this.element);
    const width = $self.width();
    const height = $self.height();
    pos.left = parseInt(pos.left, 10) - width / 2;
    pos.top = parseInt(pos.top, 10) - height / 2;

    const windowWidth = $(window).width();
    if (pos.left + width > windowWidth) {
      pos.left = windowWidth - width - 15;
    }
    $self.css(pos);
  },

  @bind
  _escListener(e) {
    if (e.key === "Escape") {
      this.cleanUp();
    } else if (e.key === "Tab") {
      if (this._activeButton === "top") {
        this._jumpBottomButton().focus();
        this._activeButton = "bottom";
        e.preventDefault();
      } else if (this._activeButton === "bottom") {
        this._jumpTopButton().focus();
        this._activeButton = "top";
        e.preventDefault();
      }
    }
  },

  _jumpTopButton() {
    return this.element.querySelector(".jump-top");
  },

  _jumpBottomButton() {
    return this.element.querySelector(".jump-bottom");
  },

  _setupEscListener() {
    document.body.addEventListener("keydown", this._escListener);
  },

  _removeEscListener() {
    document.body.removeEventListener("keydown", this._escListener);
  },

  _trapFocus() {
    this._originalActiveElement = document.activeElement;
    this._jumpTopButton().focus();
    this._activeButton = "top";
  },

  _releaseFocus() {
    if (this._originalActiveElement) {
      this._originalActiveElement.focus();
      this._originalActiveElement = null;
    }
  },

  _applyDomChanges() {
    this._setCSS();
    this._setupEscListener();
    this._trapFocus();
  },

  _show(data) {
    this._position = data.position;

    this.setProperties({ topic: data.topic, visible: true });

    scheduleOnce("afterRender", this, this._applyDomChanges);

    $("html")
      .off("mousedown.topic-entrance")
      .on("mousedown.topic-entrance", (e) => {
        const $target = $(e.target);
        if (
          $target.prop("id") === "topic-entrance" ||
          $(this.element).has($target).length !== 0
        ) {
          return;
        }
        this.cleanUp();
      });
  },

  cleanUp() {
    this.setProperties({ topic: null, visible: false });
    $("html").off("mousedown.topic-entrance");
    this._removeEscListener();
    this._releaseFocus();
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("topic-entrance:show", this, "_show");
  },

  _jumpTo(destination) {
    this.historyStore.set("lastTopicIdViewed", this.topic.id);

    this.cleanUp();
    DiscourseURL.routeTo(destination);
  },

  actions: {
    enterTop() {
      this._jumpTo(this.get("topic.url"));
    },

    enterBottom() {
      this._jumpTo(this.get("topic.lastPostUrl"));
    },
  },
});
