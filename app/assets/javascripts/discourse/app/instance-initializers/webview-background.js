import { postRNWebviewMessage } from "discourse/lib/utilities";
import discourseLater from "discourse-common/lib/later";

// Send bg color to webview so iOS status bar matches site theme
export default {
  after: "inject-objects",

  initialize(owner) {
    const caps = owner.lookup("service:capabilities");
    if (caps.isAppWebview) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addListener(this.updateAppBackground);
      this.updateAppBackground();
    }
  },
  updateAppBackground() {
    discourseLater(() => {
      const header = document.querySelector(".d-header-wrap .d-header");
      if (header) {
        const styles = window.getComputedStyle(header);
        postRNWebviewMessage("headerBg", styles.backgroundColor);
      }
    }, 500);
  },
};
