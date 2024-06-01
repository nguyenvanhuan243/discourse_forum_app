import { cached, tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { concat, hash } from "@ember/helper";
import { action, computed } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import { LinkTo } from "@ember/routing";
import { schedule } from "@ember/runloop";
import { service } from "@ember/service";
import DButton from "discourse/components/d-button";
import { INPUT_DELAY } from "discourse-common/config/environment";
import i18n from "discourse-common/helpers/i18n";
import discourseDebounce from "discourse-common/lib/debounce";
import List from "discourse/plugins/chat/discourse/components/chat/list";
import ChatModalNewMessage from "discourse/plugins/chat/discourse/components/chat/modal/new-message";
import Navbar from "discourse/plugins/chat/discourse/components/chat/navbar";
import ChatChannelCard from "discourse/plugins/chat/discourse/components/chat-channel-card";
import DcFilterInput from "discourse/plugins/chat/discourse/components/dc-filter-input";

const TABS = ["all", "open", "closed", "archived"];

export default class ChatRoutesBrowse extends Component {
  @service chatApi;
  @service modal;

  @tracked filter = "";

  @cached
  get channelsCollection() {
    return this.chatApi.channels({
      filter: this.filter,
      status: this.status,
    });
  }

  @computed("siteSettings.chat_allow_archiving_channels")
  get tabs() {
    if (this.siteSettings.chat_allow_archiving_channels) {
      return TABS;
    } else {
      return [...TABS].removeObject("archived");
    }
  }

  @action
  showChatNewMessageModal() {
    this.modal.show(ChatModalNewMessage);
  }

  @action
  setFilter(event) {
    this.filter = event.target.value;
    discourseDebounce(this.debouncedLoad, INPUT_DELAY);
  }

  @action
  debouncedLoad() {
    this.channelsCollection.load({ limit: 10 });
  }

  @action
  focusFilterInput(input) {
    schedule("afterRender", () => input?.focus());
  }

  <template>
    <div class="c-routes-browse">
      <Navbar as |navbar|>
        <navbar.BackButton />
        <navbar.Title @title={{i18n "chat.browse.title"}} />

        <navbar.Actions as |a|>
          <a.NewChannelButton />
        </navbar.Actions>
      </Navbar>

      <div class="chat-browse-view">
        <div class="chat-browse-view__actions">
          <nav>
            <ul class="nav-pills chat-browse-view__filters">
              {{#each this.tabs as |tab|}}
                <li class={{concat "chat-browse-view__filter -" tab}}>
                  <LinkTo
                    @route={{concat "chat.browse." tab}}
                    class={{concat "chat-browse-view__filter-link -" tab}}
                  >
                    {{i18n (concat "chat.browse.filter_" tab)}}
                  </LinkTo>
                </li>
              {{/each}}
            </ul>
          </nav>

          <DcFilterInput
            {{didInsert this.focusFilterInput}}
            @filterAction={{this.setFilter}}
            @icons={{hash right="search"}}
            @containerClass="filter-input"
            placeholder={{i18n "chat.browse.filter_input_placeholder"}}
          />
        </div>

        <div class="chat-browse-view__content_wrapper">
          <div class="chat-browse-view__content">
            <List
              @collection={{this.channelsCollection}}
              class="chat-browse-view__cards"
              as |list|
            >
              <list.Item as |channel|>
                <ChatChannelCard @channel={{channel}} />
              </list.Item>

              <list.EmptyState>
                <span class="empty-state-title">
                  {{i18n "chat.empty_state.title"}}
                </span>
                <div class="empty-state-body">
                  <p>{{i18n "chat.empty_state.direct_message"}}</p>
                  <DButton
                    @action={{this.showChatNewMessageModal}}
                    @label="chat.empty_state.direct_message_cta"
                  />
                </div>
              </list.EmptyState>
            </List>
          </div>
        </div>
      </div>
    </div>
  </template>
}
