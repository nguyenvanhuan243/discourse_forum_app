import Component from "@glimmer/component";
import { LinkTo } from "@ember/routing";
import { service } from "@ember/service";
import icon from "discourse-common/helpers/d-icon";
import i18n from "discourse-common/helpers/i18n";

export default class ChatNavbarCloseThreadButton extends Component {
  @service site;

  <template>
    {{#if this.site.desktopView}}
      <LinkTo
        class="c-navbar__close-thread-button btn-transparent btn btn-icon no-text"
        @route="chat.channel"
        @models={{@thread.channel.routeModels}}
        title={{i18n "chat.thread.close"}}
      >
        {{icon "times"}}
      </LinkTo>
    {{/if}}
  </template>
}
