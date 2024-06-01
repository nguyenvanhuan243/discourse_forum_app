import Component from "@glimmer/component";
import { concat, hash } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import { service } from "@ember/service";
import { eq, gt } from "truth-helpers";
import PluginOutlet from "discourse/components/plugin-outlet";
import ActionList from "discourse/components/topic-list/action-list";
import ActivityColumn from "discourse/components/topic-list/activity-column";
import ParticipantGroups from "discourse/components/topic-list/participant-groups";
import PostCountOrBadges from "discourse/components/topic-list/post-count-or-badges";
import PostersColumn from "discourse/components/topic-list/posters-column";
import PostsCountColumn from "discourse/components/topic-list/posts-count-column";
import TopicExcerpt from "discourse/components/topic-list/topic-excerpt";
import TopicLink from "discourse/components/topic-list/topic-link";
import UnreadIndicator from "discourse/components/topic-list/unread-indicator";
import TopicPostBadges from "discourse/components/topic-post-badges";
import TopicStatus from "discourse/components/topic-status";
import { topicTitleDecorators } from "discourse/components/topic-title";
import avatar from "discourse/helpers/avatar";
import categoryLink from "discourse/helpers/category-link";
import concatClass from "discourse/helpers/concat-class";
import discourseTags from "discourse/helpers/discourse-tags";
import formatDate from "discourse/helpers/format-date";
import number from "discourse/helpers/number";
import topicFeaturedLink from "discourse/helpers/topic-featured-link";
import { wantsNewWindow } from "discourse/lib/intercept-click";
import DiscourseURL, { groupPath } from "discourse/lib/url";
import icon from "discourse-common/helpers/d-icon";
import i18n from "discourse-common/helpers/i18n";
import { bind } from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default class TopicListItem extends Component {
  @service appEvents;
  @service currentUser;
  @service historyStore;
  @service messageBus;
  @service router;
  @service site;
  @service siteSettings;

  constructor() {
    super(...arguments);

    if (this.includeUnreadIndicator) {
      this.messageBus.subscribe(this.unreadIndicatorChannel, this.onMessage);
    }
  }

  willDestroy() {
    super.willDestroy(...arguments);

    this.messageBus.unsubscribe(this.unreadIndicatorChannel, this.onMessage);
  }

  @bind
  onMessage(data) {
    const nodeClassList = document.querySelector(
      `.indicator-topic-${data.topic_id}`
    ).classList;

    nodeClassList.toggle("read", !data.show_indicator);
  }

  get unreadIndicatorChannel() {
    return `/private-messages/unread-indicator/${this.args.topic.id}`;
  }

  get includeUnreadIndicator() {
    return typeof this.args.topic.unread_by_group_member !== "undefined";
  }

  get isSelected() {
    return this.args.selected?.includes(this.args.topic);
  }

  get participantGroups() {
    if (!this.args.topic.participant_groups) {
      return [];
    }

    return this.args.topic.participant_groups.map((name) => ({
      name,
      url: groupPath(name),
    }));
  }

  get newDotText() {
    return this.currentUser?.trust_level > 0
      ? ""
      : I18n.t("filters.new.lower_title");
  }

  get tagClassNames() {
    return this.args.topic.tags?.map((tagName) => `tag-${tagName}`);
  }

  get expandPinned() {
    if (
      !this.args.topic.pinned ||
      (this.site.mobileView && !this.siteSettings.show_pinned_excerpt_mobile) ||
      (this.site.desktopView && !this.siteSettings.show_pinned_excerpt_desktop)
    ) {
      return false;
    }

    return (
      (this.args.expandGloballyPinned && this.args.topic.pinned_globally) ||
      this.args.expandAllPinned
    );
  }

  get shouldFocusLastVisited() {
    return this.site.desktopView && this.args.focusLastVisitedTopic;
  }

  get unreadClass() {
    return this.args.topic.unread_by_group_member ? "" : "read";
  }

  navigateToTopic(topic, href) {
    this.historyStore.set("lastTopicIdViewed", topic.id);
    DiscourseURL.routeTo(href || topic.url);
  }

  highlight(element, isLastViewedTopic) {
    element.classList.add("highlighted");
    element.setAttribute("data-islastviewedtopic", isLastViewedTopic);
    element.addEventListener(
      "animationend",
      () => element.classList.remove("highlighted"),
      { once: true }
    );

    if (isLastViewedTopic && this.shouldFocusLastVisited) {
      element.querySelector(".main-link .title")?.focus();
    }
  }

  @action
  highlightIfNeeded(element) {
    if (this.args.topic.id === this.historyStore.get("lastTopicIdViewed")) {
      this.historyStore.delete("lastTopicIdViewed");
      this.highlight(element, true);
    } else if (this.args.topic.highlight) {
      // highlight new topics that have been loaded from the server or the one we just created
      this.args.topic.set("highlight", false);
      this.highlight(element, false);
    }
  }

  @action
  onTitleFocus(event) {
    event.target.classList.add("selected");
  }

  @action
  onTitleBlur(event) {
    event.target.classList.remove("selected");
  }

  @action
  applyTitleDecorators(element) {
    const rawTopicLink = element.querySelector(".raw-topic-link");

    if (rawTopicLink) {
      topicTitleDecorators?.forEach((cb) =>
        cb(this.args.topic, rawTopicLink, "topic-list-item-title")
      );
    }
  }

  @action
  onBulkSelectToggle(e) {
    if (e.target.checked) {
      this.args.selected.addObject(this.args.topic);

      if (this.args.lastCheckedElementId && e.shiftKey) {
        const bulkSelects = Array.from(
          document.querySelectorAll("input.bulk-select")
        );
        const from = bulkSelects.indexOf(e.target);
        const to = bulkSelects.findIndex(
          (el) => el.id === this.args.lastCheckedElementId
        );
        const start = Math.min(from, to);
        const end = Math.max(from, to);

        bulkSelects
          .slice(start, end)
          .filter((el) => !el.checked)
          .forEach((checkbox) => checkbox.click());
      }

      this.args.updateLastCheckedElementId(e.target.id);
    } else {
      this.args.selected.removeObject(this.args.topic);
      this.args.updateLastCheckedElementId(null);
    }
  }

  @action
  click(e) {
    if (
      e.target.classList.contains("raw-topic-link") ||
      e.target.classList.contains("post-activity")
    ) {
      if (wantsNewWindow(e)) {
        return;
      }

      e.preventDefault();
      this.navigateToTopic(this.args.topic, e.target.href);
      return;
    }

    // make full row click target on mobile, due to size constraints
    if (
      this.site.mobileView &&
      e.target.matches(
        ".topic-list-data, .main-link, .right, .topic-item-stats, .topic-item-stats__category-tags, .discourse-tags"
      )
    ) {
      if (wantsNewWindow(e)) {
        return;
      }

      e.preventDefault();
      this.navigateToTopic(this.args.topic, this.args.topic.lastUnreadUrl);
      return;
    }

    if (
      e.target.classList.contains("d-icon-thumbtack") &&
      e.target.closest("a.topic-status")
    ) {
      e.preventDefault();
      this.args.topic.togglePinnedForUser();
      return;
    }
  }

  @action
  keyDown(e) {
    if (e.key === "Enter" && e.target.classList.contains("post-activity")) {
      e.preventDefault();
      this.navigateToTopic(this.args.topic, e.target.href);
    }
  }

  <template>
    <tr
      {{! template-lint-disable no-invalid-interactive }}
      {{didInsert this.applyTitleDecorators}}
      {{didInsert this.highlightIfNeeded}}
      {{on "keydown" this.keyDown}}
      {{on "click" this.click}}
      data-topic-id={{@topic.id}}
      role={{this.role}}
      aria-level={{this.ariaLevel}}
      class={{concatClass
        "topic-list-item"
        (if @topic.category (concat "category-" @topic.category.fullSlug))
        (if (eq @topic @lastVisitedTopic) "last-visit")
        (if @topic.visited "visited")
        (if @topic.hasExcerpt "has-excerpt")
        (if @topic.unseen "unseen-topic")
        (if @topic.unread_posts "unread-posts")
        (if @topic.liked "liked")
        (if @topic.archived "archived")
        (if @topic.bookmarked "bookmarked")
        (if @topic.pinned "pinned")
        (if @topic.closed "closed")
        this.tagClassNames
      }}
    >
      <PluginOutlet
        @name="above-topic-list-item"
        @outletArgs={{hash topic=@topic}}
      />
      {{#if this.site.desktopView}}
        <PluginOutlet @name="topic-list-before-columns" />

        {{#if @bulkSelectEnabled}}
          <td class="bulk-select topic-list-data">
            <label for="bulk-select-{{@topic.id}}">
              <input
                {{on "click" this.onBulkSelectToggle}}
                checked={{this.isSelected}}
                type="checkbox"
                id="bulk-select-{{@topic.id}}"
                class="bulk-select"
              />
            </label>
          </td>
        {{/if}}

        <td class="main-link clearfix topic-list-data" colspan="1">
          <PluginOutlet @name="topic-list-before-link" />

          <span class="link-top-line">
            {{~! no whitespace ~}}
            <PluginOutlet @name="topic-list-before-status" />
            {{~! no whitespace ~}}
            <TopicStatus @topic={{@topic}} />
            {{~! no whitespace ~}}
            <TopicLink
              {{on "focus" this.onTitleFocus}}
              {{on "blur" this.onTitleBlur}}
              @topic={{@topic}}
              class="raw-link raw-topic-link"
            />
            {{~#if @topic.featured_link~}}
              &nbsp;
              {{~topicFeaturedLink @topic}}
            {{~/if~}}
            <PluginOutlet @name="topic-list-after-title" />
            {{~! no whitespace ~}}
            <UnreadIndicator
              @includeUnreadIndicator={{this.includeUnreadIndicator}}
              @topicId={{@topic.id}}
              class={{this.unreadClass}}
            />
            {{~#if @showTopicPostBadges~}}
              <TopicPostBadges
                @unreadPosts={{@topic.unread_posts}}
                @unseen={{@topic.unseen}}
                @newDotText={{this.newDotText}}
                @url={{@topic.lastUnreadUrl}}
              />
            {{~/if~}}
          </span>

          <div class="link-bottom-line">
            {{#unless @hideCategory}}
              {{#unless @topic.isPinnedUncategorized}}
                <PluginOutlet @name="topic-list-before-category" />
                {{categoryLink @topic.category}}
              {{/unless}}
            {{/unless}}

            {{discourseTags @topic mode="list" tagsForUser=@tagsForUser}}

            {{#if this.participantGroups}}
              <ParticipantGroups @groups={{this.participantGroups}} />
            {{/if}}

            <ActionList
              @topic={{@topic}}
              @postNumbers={{@topic.liked_post_numbers}}
              @icon="heart"
              class="likes"
            />
          </div>

          {{#if this.expandPinned}}
            <TopicExcerpt @topic={{@topic}} />
          {{/if}}

          <PluginOutlet @name="topic-list-main-link-bottom" />
        </td>

        <PluginOutlet @name="topic-list-after-main-link" />

        {{#if @showPosters}}
          <PostersColumn @posters={{@topic.featuredUsers}} />
        {{/if}}

        <PostsCountColumn @topic={{@topic}} />

        {{#if @showLikes}}
          <td class="num likes topic-list-data">
            {{#if (gt @topic.like_count 0)}}
              <a href={{@topic.summaryUrl}}>
                {{number @topic.like_count}}
                {{icon "heart"}}
              </a>
            {{/if}}
          </td>
        {{/if}}

        {{#if @showOpLikes}}
          <td class="num likes">
            {{#if (gt @topic.op_like_count 0)}}
              <a href={{@topic.summaryUrl}}>
                {{number @topic.op_like_count}}
                {{icon "heart"}}
              </a>
            {{/if}}
          </td>
        {{/if}}

        <td class={{concatClass "num views topic-list-data" @topic.viewsHeat}}>
          <PluginOutlet @name="topic-list-before-view-count" />
          {{number @topic.views numberKey="views_long"}}
        </td>

        <ActivityColumn @topic={{@topic}} class="num topic-list-data" />

        <PluginOutlet @name="topic-list-after-columns" />
      {{else}}
        <td class="topic-list-data">
          <PluginOutlet @name="topic-list-before-columns" />

          <div class="pull-left">
            {{#if @bulkSelectEnabled}}
              <label for="bulk-select-{{@topic.id}}">
                <input
                  type="checkbox"
                  id="bulk-select-{{@topic.id}}"
                  class="bulk-select"
                />
              </label>
            {{else}}
              <a
                href={{@topic.lastPostUrl}}
                aria-label={{i18n
                  "latest_poster_link"
                  username=@topic.lastPosterUser.username
                }}
                data-user-card={{@topic.lastPosterUser.username}}
              >{{avatar @topic.lastPosterUser imageSize="large"}}</a>
            {{/if}}
          </div>

          <div class="topic-item-metadata right">
            {{~! no whitespace ~}}
            <PluginOutlet @name="topic-list-before-link" />

            <div class="main-link">
              {{~! no whitespace ~}}
              <PluginOutlet @name="topic-list-before-status" />
              {{~! no whitespace ~}}
              <TopicStatus @topic={{@topic}} />
              {{~! no whitespace ~}}
              <TopicLink
                {{on "focus" this.onTitleFocus}}
                {{on "blur" this.onTitleBlur}}
                @topic={{@topic}}
                class="raw-link raw-topic-link"
              />
              {{~#if @topic.featured_link~}}
                {{topicFeaturedLink @topic}}
              {{~/if~}}
              <PluginOutlet @name="topic-list-after-title" />
              {{~#if @topic.unseen~}}
                <span class="topic-post-badges">&nbsp;<span
                    class="badge-notification new-topic"
                  ></span></span>
              {{~/if~}}
              {{~#if this.expandPinned~}}
                <TopicExcerpt @topic={{@topic}} />
              {{~/if~}}
              <PluginOutlet @name="topic-list-main-link-bottom" />
            </div>
            {{~! no whitespace ~}}
            <PluginOutlet @name="topic-list-after-main-link" />

            <div class="pull-right">
              <PostCountOrBadges
                @topic={{@topic}}
                @postBadgesEnabled={{@showTopicPostBadges}}
              />
            </div>

            <div class="topic-item-stats clearfix">
              <span class="topic-item-stats__category-tags">
                {{#unless @hideCategory}}
                  <PluginOutlet @name="topic-list-before-category" />
                  {{categoryLink @topic.category}}
                {{/unless}}

                {{discourseTags @topic mode="list"}}
              </span>

              <div class="num activity last">
                <span title={{@topic.bumpedAtTitle}} class="age activity">
                  <a href={{@topic.lastPostUrl}}>{{formatDate
                      @topic.bumpedAt
                      format="tiny"
                      noTitle="true"
                    }}</a>
                </span>
              </div>
            </div>
          </div>
        </td>
      {{/if}}
    </tr>
  </template>
}
