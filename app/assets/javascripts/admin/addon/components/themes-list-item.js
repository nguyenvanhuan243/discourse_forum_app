import Component from "@ember/component";
import { action } from "@ember/object";
import { and, gt } from "@ember/object/computed";
import { classNameBindings, classNames } from "@ember-decorators/component";
import escape from "discourse-common/lib/escape";
import { iconHTML } from "discourse-common/lib/icon-library";
import discourseComputed from "discourse-common/utils/decorators";

const MAX_COMPONENTS = 4;

@classNames("themes-list-container__item")
@classNameBindings("theme.selected:selected")
export default class ThemesListItem extends Component {
  childrenExpanded = false;

  @gt("children.length", 0) hasComponents;

  @and("hasComponents", "theme.isActive") displayComponents;

  @gt("theme.childThemes.length", MAX_COMPONENTS) displayHasMore;

  click(e) {
    if (!e.target.classList.contains("others-count")) {
      this.navigateToTheme();
    }
  }

  @discourseComputed(
    "theme.component",
    "theme.childThemes.@each.name",
    "theme.childThemes.length",
    "childrenExpanded"
  )
  children() {
    const theme = this.theme;
    let children = theme.get("childThemes");
    if (theme.get("component") || !children) {
      return [];
    }
    children = this.childrenExpanded
      ? children
      : children.slice(0, MAX_COMPONENTS);
    return children.map((t) => {
      const name = escape(t.name);
      return t.enabled ? name : `${iconHTML("ban")} ${name}`;
    });
  }

  @discourseComputed("children")
  childrenString(children) {
    return children.join(", ");
  }

  @discourseComputed(
    "theme.childThemes.length",
    "theme.component",
    "childrenExpanded",
    "children.length"
  )
  moreCount(childrenCount, component, expanded) {
    if (component || !childrenCount || expanded) {
      return 0;
    }
    return childrenCount - MAX_COMPONENTS;
  }

  @action
  toggleChildrenExpanded(event) {
    event?.preventDefault();
    this.toggleProperty("childrenExpanded");
  }
}
