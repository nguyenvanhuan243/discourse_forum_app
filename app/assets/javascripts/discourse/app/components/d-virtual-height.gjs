import Component from "@glimmer/component";
import { cancel, scheduleOnce } from "@ember/runloop";
import { service } from "@ember/service";
import { clearAllBodyScrollLocks } from "discourse/lib/body-scroll-lock";
import isZoomed from "discourse/lib/zoom-check";
import discourseDebounce from "discourse-common/lib/debounce";
import { bind } from "discourse-common/utils/decorators";

const KEYBOARD_DETECT_THRESHOLD = 150;

export default class DVirtualHeight extends Component {
  @service site;
  @service capabilities;
  @service appEvents;

  constructor() {
    super(...arguments);

    if (!window.visualViewport) {
      return;
    }

    if (!this.capabilities.isIpadOS && this.site.desktopView) {
      return;
    }

    // TODO: Handle device rotation
    this.windowInnerHeight = window.innerHeight;

    scheduleOnce("afterRender", this, this.debouncedOnViewportResize);

    window.visualViewport.addEventListener(
      "resize",
      this.debouncedOnViewportResize
    );
    if ("virtualKeyboard" in navigator) {
      navigator.virtualKeyboard.overlaysContent = true;
      navigator.virtualKeyboard.addEventListener(
        "geometrychange",
        this.debouncedOnViewportResize
      );
    }
  }

  willDestroy() {
    super.willDestroy(...arguments);

    cancel(this.debouncedHandler);

    window.visualViewport.removeEventListener(
      "resize",
      this.debouncedOnViewportResize
    );
    if ("virtualKeyboard" in navigator) {
      navigator.virtualKeyboard.overlaysContent = false;
      navigator.virtualKeyboard.removeEventListener(
        "geometrychange",
        this.debouncedOnViewportResize
      );
    }
  }

  setVH() {
    if (isZoomed()) {
      return;
    }

    let height;
    if ("virtualKeyboard" in navigator) {
      height =
        window.visualViewport.height -
        navigator.virtualKeyboard.boundingRect.height;
    } else {
      const activeWindow = window.visualViewport || window;
      height = activeWindow?.height || window.innerHeight;
    }

    const newVh = height * 0.01;
    if (this.lastVh === newVh) {
      return;
    }

    document.documentElement.style.setProperty("--composer-vh", `${newVh}px`);
    this.lastVh = newVh;
  }

  @bind
  debouncedOnViewportResize() {
    this.debouncedHandler = discourseDebounce(this, this.onViewportResize, 50);
  }

  @bind
  onViewportResize() {
    this.setVH();

    let keyboardVisible = false;
    if ("virtualKeyboard" in navigator) {
      if (navigator.virtualKeyboard.boundingRect.height > 0) {
        keyboardVisible = true;
      }
    } else if (this.capabilities.isFirefox && this.capabilities.isAndroid) {
      if (
        Math.abs(
          this.windowInnerHeight -
            Math.min(window.innerHeight, window.visualViewport.height)
        ) > KEYBOARD_DETECT_THRESHOLD
      ) {
        keyboardVisible = true;
      }
    } else {
      let viewportWindowDiff =
        this.windowInnerHeight - window.visualViewport.height;
      const IPAD_HARDWARE_KEYBOARD_TOOLBAR_HEIGHT = 71.5;
      if (viewportWindowDiff > IPAD_HARDWARE_KEYBOARD_TOOLBAR_HEIGHT) {
        keyboardVisible = true;
      }

      // adds bottom padding when using a hardware keyboard and the accessory bar is visible
      // accessory bar height is 55px, using 75 allows a small buffer
      if (this.capabilities.isIpadOS) {
        document.documentElement.style.setProperty(
          "--composer-ipad-padding",
          `${viewportWindowDiff < 75 ? viewportWindowDiff : 0}px`
        );
      }
    }

    this.appEvents.trigger("keyboard-visibility-change", keyboardVisible);

    keyboardVisible
      ? document.documentElement.classList.add("keyboard-visible")
      : document.documentElement.classList.remove("keyboard-visible");

    if (!keyboardVisible) {
      clearAllBodyScrollLocks();
    }
  }
}
