import Component from "@glimmer/component";
import { cached, tracked } from "@glimmer/tracking";
import { concat } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import willDestroy from "@ember/render-modifiers/modifiers/will-destroy";
import { service } from "@ember/service";
import { modifier as modifierFn } from "ember-modifier";
import { and, not, or } from "truth-helpers";
import ConditionalInElement from "discourse/components/conditional-in-element";
import DButton from "discourse/components/d-button";
import concatClass from "discourse/helpers/concat-class";
import element from "discourse/helpers/element";
import {
  disableBodyScroll,
  enableBodyScroll,
} from "discourse/lib/body-scroll-lock";
import { getMaxAnimationTimeMs } from "discourse/lib/swipe-events";
import swipe from "discourse/modifiers/swipe";
import trapTab from "discourse/modifiers/trap-tab";
import { bind } from "discourse-common/utils/decorators";

export const CLOSE_INITIATED_BY_BUTTON = "initiatedByCloseButton";
export const CLOSE_INITIATED_BY_ESC = "initiatedByESC";
export const CLOSE_INITIATED_BY_CLICK_OUTSIDE = "initiatedByClickOut";
export const CLOSE_INITIATED_BY_MODAL_SHOW = "initiatedByModalShow";
export const CLOSE_INITIATED_BY_SWIPE_DOWN = "initiatedBySwipeDown";

const FLASH_TYPES = ["success", "error", "warning", "info"];

const SWIPE_VELOCITY_THRESHOLD = 0.4;

export default class DModal extends Component {
  @service modal;
  @service site;
  @service appEvents;

  @tracked wrapperElement;
  @tracked animating = false;

  registerModalContainer = modifierFn((el) => {
    this.modalContainer = el;
  });

  setupModalBody = modifierFn((el) => {
    if (!this.site.mobileView) {
      return;
    }

    disableBodyScroll(el);

    return () => {
      enableBodyScroll(el);
    };
  });

  @action
  async setupModal(el) {
    document.documentElement.addEventListener(
      "keydown",
      this.handleDocumentKeydown
    );

    this.appEvents.on(
      "keyboard-visibility-change",
      this.handleKeyboardVisibilityChange
    );

    if (this.site.mobileView) {
      this.animating = true;

      await el.animate(
        [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
        {
          duration: getMaxAnimationTimeMs(),
          easing: "ease",
          fill: "forwards",
        }
      ).finished;

      this.animating = false;
    }

    this.wrapperElement = el;
  }

  @action
  cleanupModal() {
    document.documentElement.removeEventListener(
      "keydown",
      this.handleDocumentKeydown
    );

    this.appEvents.off(
      "keyboard-visibility-change",
      this.handleKeyboardVisibilityChange
    );
  }

  get dismissable() {
    if (!this.args.closeModal) {
      return false;
    } else if ("dismissable" in this.args) {
      return this.args.dismissable;
    } else {
      return true;
    }
  }

  shouldTriggerClickOnEnter(event) {
    if (this.args.submitOnEnter === false) {
      return false;
    }

    // skip when in a form or a textarea element
    if (
      event.target.closest("form") ||
      document.activeElement?.nodeName === "TEXTAREA"
    ) {
      return false;
    }

    return true;
  }

  @action
  async handleSwipe(swipeEvent) {
    if (this.animating) {
      return;
    }

    if (swipeEvent.deltaY >= 0) {
      return await this.#animateWrapperPosition(swipeEvent.deltaY);
    }
  }

  @action
  async handleSwipeEnded(swipeEvent) {
    if (this.animating) {
      // if the modal is animating we don't want to risk resetting the position
      // as the user releases the swipe at the same time
      return;
    }

    if (
      swipeEvent.goingUp() ||
      swipeEvent.velocityY < SWIPE_VELOCITY_THRESHOLD
    ) {
      return await this.#animateWrapperPosition(0);
    }

    this.modalContainer.style.transform = `translateY(${swipeEvent.deltaY}px)`;
    this.closeModal(CLOSE_INITIATED_BY_SWIPE_DOWN);
  }

  @action
  handleWrapperClick(e) {
    if (e.button !== 0) {
      return; // Non-default mouse button
    }

    if (!this.dismissable) {
      return;
    }

    return this.closeModal(CLOSE_INITIATED_BY_CLICK_OUTSIDE);
  }

  @action
  async closeModal(initiatedBy) {
    if (!this.args.closeModal) {
      return;
    }

    if (this.site.mobileView) {
      this.animating = true;

      this.#animateBackdropOpacity(window.innerHeight);

      await this.#animateWrapperPosition(this.modalContainer.clientHeight);

      this.animating = false;
    }

    this.args.closeModal({ initiatedBy });
  }

  @action
  handleDocumentKeydown(event) {
    if (this.args.hidden) {
      return;
    }

    if (event.key === "Escape" && this.dismissable) {
      event.stopPropagation();
      this.closeModal(CLOSE_INITIATED_BY_ESC);
    }

    if (event.key === "Enter" && this.shouldTriggerClickOnEnter(event)) {
      this.wrapperElement
        .querySelector(".d-modal__footer .btn-primary")
        ?.click();
      event.preventDefault();
    }
  }

  @action
  handleCloseButton() {
    this.closeModal(CLOSE_INITIATED_BY_BUTTON);
  }

  @action
  validateFlashType(type) {
    if (type && !FLASH_TYPES.includes(type)) {
      throw `@flashType must be one of ${FLASH_TYPES.join(", ")}`;
    }
  }

  // Could be optimised to remove classic component once RFC389 is implemented
  // https://rfcs.emberjs.com/id/0389-dynamic-tag-names
  @cached
  get dynamicElement() {
    const tagName = this.args.tagName || "div";
    if (!["div", "form"].includes(tagName)) {
      throw `@tagName must be form or div`;
    }

    return element(tagName);
  }

  @bind
  handleKeyboardVisibilityChange(visible) {
    if (visible) {
      window.scrollTo(0, 0);
    }
  }

  #animateBackdropOpacity(position) {
    const backdrop = this.wrapperElement.nextElementSibling;

    if (!backdrop) {
      return;
    }

    const opacity = 1 - position / this.modalContainer.clientHeight;
    backdrop.animate([{ opacity: Math.max(0, Math.min(opacity, 0.6)) }], {
      fill: "forwards",
    });
  }

  async #animateWrapperPosition(position) {
    this.#animateBackdropOpacity(position);

    await this.modalContainer.animate(
      [{ transform: `translateY(${position}px)` }],
      {
        fill: "forwards",
        duration: getMaxAnimationTimeMs(),
      }
    ).finished;
  }

  <template>
    {{! template-lint-disable no-invalid-interactive }}

    <ConditionalInElement
      @element={{this.modal.containerElement}}
      @inline={{@inline}}
      @append={{true}}
    >
      <this.dynamicElement
        class={{concatClass
          "modal"
          "d-modal"
          (if @inline "-inline")
          (if this.animating "is-animating")
        }}
        data-keyboard="false"
        aria-modal="true"
        role="dialog"
        aria-labelledby={{if @title "discourse-modal-title"}}
        ...attributes
        {{didInsert this.setupModal}}
        {{willDestroy this.cleanupModal}}
        {{trapTab preventScroll=false}}
      >
        <div class="d-modal__container" {{this.registerModalContainer}}>
          {{yield to="aboveHeader"}}

          {{#if
            (and
              (not @hideHeader)
              (or
                this.dismissable
                @title
                (has-block "headerBelowTitle")
                (has-block "headerAboveTitle")
              )
            )
          }}
            <div
              class={{concatClass "d-modal__header" @headerClass}}
              {{swipe
                onDidSwipe=this.handleSwipe
                onDidEndSwipe=this.handleSwipeEnded
                enabled=this.dismissable
              }}
            >
              {{yield to="headerAboveTitle"}}

              {{#if
                (and
                  this.site.mobileView
                  this.dismissable
                  (has-block "headerPrimaryAction")
                )
              }}
                <div class="d-modal__dismiss-action">
                  <DButton
                    @label="cancel"
                    @action={{this.handleCloseButton}}
                    @title="modal.close"
                    class="btn-transparent btn-primary d-modal__dismiss-action-button"
                  />
                </div>
              {{/if}}

              {{#if @title}}
                <div class="d-modal__title">
                  <h1
                    id="discourse-modal-title"
                    class="d-modal__title-text"
                  >{{@title}}</h1>

                  {{#if @subtitle}}
                    <p class="d-modal__subtitle-text">{{@subtitle}}</p>
                  {{/if}}

                  {{yield to="belowModalTitle"}}
                </div>
              {{/if}}
              {{yield to="headerBelowTitle"}}

              {{#if
                (and this.site.mobileView (has-block "headerPrimaryAction"))
              }}
                <div class="d-modal__primary-action">
                  {{yield to="headerPrimaryAction"}}
                </div>
              {{else if this.dismissable}}
                <DButton
                  @icon="times"
                  @action={{this.handleCloseButton}}
                  @title="modal.close"
                  class="btn-transparent modal-close"
                />
              {{/if}}
            </div>
          {{/if}}

          {{yield to="belowHeader"}}

          {{this.validateFlashType @flashType}}
          {{#if @flash}}
            <div
              id="modal-alert"
              role="alert"
              class={{concatClass
                "alert"
                (if @flashType (concat "alert-" @flashType))
              }}
            >
              {{~@flash~}}
            </div>
          {{/if}}

          <div
            class={{concatClass "d-modal__body" @bodyClass}}
            {{this.setupModalBody}}
            tabindex="-1"
          >
            {{#if (has-block "body")}}
              {{yield to="body"}}
            {{else}}
              {{yield}}
            {{/if}}
          </div>

          {{#if (has-block "footer")}}
            <div class="d-modal__footer">
              {{yield to="footer"}}
            </div>
          {{/if}}

          {{yield to="belowFooter"}}
        </div>
      </this.dynamicElement>
      {{#unless @inline}}
        <div
          class="d-modal__backdrop"
          {{swipe
            onDidSwipe=this.handleSwipe
            onDidEndSwipe=this.handleSwipeEnded
            enabled=this.dismissable
          }}
          {{on "click" this.handleWrapperClick}}
        ></div>
      {{/unless}}
    </ConditionalInElement>
  </template>
}
