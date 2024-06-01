import Component from "@ember/component";
import { action, computed } from "@ember/object";
import { not } from "@ember/object/computed";
import { isPresent } from "@ember/utils";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";
import UtilsMixin from "select-kit/mixins/utils";

export default Component.extend(UtilsMixin, {
  classNames: ["select-kit-filter"],
  classNameBindings: ["isExpanded:is-expanded"],
  attributeBindings: ["role"],
  tabIndex: -1,

  isHidden: computed(
    "selectKit.options.{filterable,allowAny,autoFilterable}",
    "content.[]",
    function () {
      return (
        !this.selectKit.options.filterable &&
        !this.selectKit.options.allowAny &&
        !this.selectKit.options.autoFilterable
      );
    }
  ),

  isExpanded: not("isHidden"),

  @discourseComputed(
    "selectKit.options.filterPlaceholder",
    "selectKit.options.translatedFilterPlaceholder",
    "selectKit.options.allowAny"
  )
  placeholder(placeholder, translatedPlaceholder) {
    if (isPresent(translatedPlaceholder)) {
      return translatedPlaceholder;
    }

    if (isPresent(placeholder)) {
      return I18n.t(placeholder);
    }

    return I18n.t(
      this.selectKit.options.allowAny
        ? "select_kit.filter_placeholder_with_any"
        : "select_kit.filter_placeholder"
    );
  },

  @action
  onPaste() {},

  @action
  onInput(event) {
    this.selectKit.onInput(event);
    return true;
  },

  @action
  onKeyup(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  },

  @action
  onKeydown(event) {
    if (!this.selectKit.onKeydown(event)) {
      return false;
    }

    if (event.key === "Tab" && this.selectKit.isLoading) {
      this.selectKit.cancelSearch();
      this.selectKit.close(event);
      return true;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      return true;
    }

    if (event.key === "Backspace" && !this.selectKit.filter) {
      this.selectKit.deselectLast();
      event.preventDefault();
      return false;
    }

    if (event.key === "ArrowUp") {
      this.selectKit.highlightLast();
      event.preventDefault();
      return false;
    }

    if (event.key === "ArrowDown") {
      if (!this.selectKit.isExpanded) {
        this.selectKit.open(event);
      }
      this.selectKit.highlightFirst();
      event.preventDefault();
      return false;
    }

    if (event.key === "Escape") {
      this.selectKit.close(event);
      this.selectKit.headerElement().focus();
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    if (event.key === "Enter" && this.selectKit.highlighted) {
      this.selectKit.select(
        this.getValue(this.selectKit.highlighted),
        this.selectKit.highlighted
      );
      event.preventDefault();
      event.stopImmediatePropagation();
      return false;
    }

    if (
      event.key === "Enter" &&
      (!this.selectKit.highlighted || this.selectKit.enterDisabled)
    ) {
      this.element.querySelector("input").focus();
      if (this.selectKit.enterDisabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return false;
    }

    this.selectKit.set("highlighted", null);
  },
});
