import Component from "@glimmer/component";
import iconOrImage from "discourse/helpers/icon-or-image";
import domFromString from "discourse-common/lib/dom-from-string";

export default class BadgeButton extends Component {
  get title() {
    const description = this.args.badge?.description;
    if (description) {
      return domFromString(`<div>${description}</div>`)[0].innerText;
    }
  }

  <template>
    <span
      title={{this.title}}
      data-badge-name={{@badge.name}}
      class="user-badge
        {{@badge.badgeTypeClassName}}
        {{unless @badge.enabled 'disabled'}}"
      ...attributes
    >
      {{iconOrImage @badge}}
      <span class="badge-display-name">{{@badge.name}}</span>
      {{yield}}
    </span>
  </template>
}
