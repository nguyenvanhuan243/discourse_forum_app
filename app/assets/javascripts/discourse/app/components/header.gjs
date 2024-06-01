import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { getOwner } from "@ember/application";
import { hash } from "@ember/helper";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { modifier } from "ember-modifier";
import { and, eq, not, or } from "truth-helpers";
import PluginOutlet from "discourse/components/plugin-outlet";
import DAG from "discourse/lib/dag";
import scrollLock from "discourse/lib/scroll-lock";
import DiscourseURL from "discourse/lib/url";
import { scrollTop } from "discourse/mixins/scroll-top";
import AuthButtons from "./header/auth-buttons";
import Contents from "./header/contents";
import HamburgerDropdownWrapper from "./header/hamburger-dropdown-wrapper";
import Icons from "./header/icons";
import SearchMenuWrapper from "./header/search-menu-wrapper";
import UserMenuWrapper from "./header/user-menu-wrapper";

const SEARCH_BUTTON_ID = "search-button";

let headerButtons;
resetHeaderButtons();

function resetHeaderButtons() {
  headerButtons = new DAG({ defaultPosition: { before: "auth" } });
  headerButtons.add("auth");
}

export function headerButtonsDAG() {
  return headerButtons;
}

export function clearExtraHeaderButtons() {
  resetHeaderButtons();
}

export default class GlimmerHeader extends Component {
  @service router;
  @service search;
  @service currentUser;
  @service siteSettings;
  @service site;
  @service appEvents;
  @service header;

  @tracked skipSearchContext = this.site.mobileView;

  appEventsListeners = modifier(() => {
    this.appEvents.on(
      "header:keyboard-trigger",
      this,
      this.headerKeyboardTrigger
    );
    return () => {
      this.appEvents.off(
        "header:keyboard-trigger",
        this,
        this.headerKeyboardTrigger
      );
    };
  });

  @action
  headerKeyboardTrigger(msg) {
    switch (msg.type) {
      case "search":
        this.toggleSearchMenu();
        break;
      case "user":
        this.toggleUserMenu();
        break;
      case "hamburger":
        this.toggleNavigationMenu();
        break;
      case "page-search":
        if (!this.togglePageSearch()) {
          msg.event.preventDefault();
          msg.event.stopPropagation();
        }
        break;
    }
  }

  @action
  toggleSearchMenu() {
    if (this.site.mobileView) {
      const context = this.search.searchContext;
      let params = "";
      if (context) {
        params = `?context=${context.type}&context_id=${context.id}&skip_context=${this.skipSearchContext}`;
      }

      if (this.router.currentRouteName === "full-page-search") {
        scrollTop();
        document.querySelector(".full-page-search").focus();
        return false;
      } else {
        return DiscourseURL.routeTo("/search" + params);
      }
    }

    this.search.visible = !this.search.visible;
    if (!this.search.visible) {
      this.search.highlightTerm = "";
      this.search.inTopicContext = false;
      document.getElementById(SEARCH_BUTTON_ID)?.focus();
    }
  }

  @action
  togglePageSearch() {
    this.search.inTopicContext = false;

    let showSearch = this.router.currentRouteName.startsWith("topic.");
    // If we're viewing a topic, only intercept search if there are cloaked posts
    if (showSearch) {
      const container = getOwner(this);
      const topic = container.lookup("controller:topic");
      const total = topic.get("model.postStream.stream.length") || 0;
      const chunkSize = topic.get("model.chunk_size") || 0;
      showSearch =
        total > chunkSize &&
        document.querySelectorAll(
          ".topic-post .cooked, .small-action:not(.time-gap)"
        )?.length < total;
    }

    if (this.search.visible) {
      this.toggleSearchMenu();
      return showSearch;
    }

    if (showSearch) {
      this.search.inTopicContext = true;
      this.toggleSearchMenu();
      return false;
    }

    return true;
  }

  @action
  toggleUserMenu() {
    this.header.userVisible = !this.header.userVisible;
    this.toggleBodyScrolling(this.header.userVisible);
    this.args.animateMenu();
  }

  @action
  toggleNavigationMenu(override = null) {
    if (override === "sidebar") {
      return this.toggleSidebar();
    }

    if (override === "hamburger") {
      return this.toggleHamburger();
    }

    if (this.args.sidebarEnabled && !this.site.narrowDesktopView) {
      this.toggleSidebar();
    } else {
      this.toggleHamburger();
    }
  }

  @action
  toggleHamburger() {
    this.header.hamburgerVisible = !this.header.hamburgerVisible;
    this.toggleBodyScrolling(this.header.hamburgerVisible);
    this.args.animateMenu();
  }

  @action
  toggleSidebar() {
    this.args.toggleSidebar();
    this.args.animateMenu();
  }

  @action
  toggleBodyScrolling(bool) {
    if (this.site.mobileView) {
      scrollLock(bool);
    }
  }

  <template>
    <header class="d-header" {{this.appEventsListeners}}>
      <div class="wrap">
        <Contents
          @sidebarEnabled={{@sidebarEnabled}}
          @toggleNavigationMenu={{this.toggleNavigationMenu}}
          @showSidebar={{@showSidebar}}
        >
          <span class="header-buttons">
            {{#each (headerButtons.resolve) as |entry|}}
              {{#if (and (eq entry.key "auth") (not this.currentUser))}}
                <AuthButtons
                  @showCreateAccount={{@showCreateAccount}}
                  @showLogin={{@showLogin}}
                  @canSignUp={{@canSignUp}}
                />
              {{else if entry.value}}
                <entry.value />
              {{/if}}
            {{/each}}
          </span>

          {{#if
            (not (and this.siteSettings.login_required (not this.currentUser)))
          }}
            <Icons
              @sidebarEnabled={{@sidebarEnabled}}
              @toggleSearchMenu={{this.toggleSearchMenu}}
              @toggleNavigationMenu={{this.toggleNavigationMenu}}
              @toggleUserMenu={{this.toggleUserMenu}}
              @searchButtonId={{SEARCH_BUTTON_ID}}
            />
          {{/if}}

          {{#if this.search.visible}}
            <SearchMenuWrapper @closeSearchMenu={{this.toggleSearchMenu}} />
          {{else if this.header.hamburgerVisible}}
            <HamburgerDropdownWrapper
              @toggleNavigationMenu={{this.toggleNavigationMenu}}
              @sidebarEnabled={{@sidebarEnabled}}
            />
          {{else if this.header.userVisible}}
            <UserMenuWrapper @toggleUserMenu={{this.toggleUserMenu}} />
          {{/if}}

          {{#if
            (and
              (or this.site.mobileView this.site.narrowDesktopView)
              (or this.header.hamburgerVisible this.header.userVisible)
            )
          }}
            <div class="header-cloak"></div>
          {{/if}}
        </Contents>
      </div>
      <PluginOutlet
        @name="after-header"
        @outletArgs={{hash minimized=(globalThis.Boolean this.header.topic)}}
      />
    </header>
  </template>
}
