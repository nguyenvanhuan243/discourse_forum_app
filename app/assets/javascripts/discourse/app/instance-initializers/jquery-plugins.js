import "bootstrap/js/modal";
import bootbox from "bootbox";
import $ from "jquery";
import autocomplete from "discourse/lib/autocomplete";
import { caret, caretPosition } from "discourse/lib/caret-position";
import deprecated from "discourse-common/lib/deprecated";
import { getOwnerWithFallback } from "discourse-common/lib/get-owner";

let jqueryPluginsConfigured = false;

export default {
  initialize() {
    if (jqueryPluginsConfigured) {
      return;
    }

    // Settings for bootbox
    bootbox.animate(false);
    bootbox.backdrop(true);

    // Monkey-patching simple alerts
    const originalAlert = bootbox.alert;
    bootbox.alert = function () {
      if (arguments.length === 1) {
        const dialog = getOwnerWithFallback(this).lookup("service:dialog");
        if (dialog) {
          deprecated(
            "`bootbox.alert` is deprecated, please use the dialog service instead.",
            {
              id: "discourse.bootbox",
              dropFrom: "3.1.0.beta5",
              url: "https://meta.discourse.org/t/244902",
            }
          );
          return dialog.alert(arguments[0]);
        }
      }
      return originalAlert(...arguments);
    };

    // adding deprecation notice for all other dialogs
    const originalDialog = bootbox.dialog;
    bootbox.dialog = function () {
      deprecated(
        "`bootbox` is now deprecated, please use the dialog service instead.",
        {
          id: "discourse.bootbox",
          dropFrom: "3.1.0.beta5",
          url: "https://meta.discourse.org/t/244902",
        }
      );
      return originalDialog(...arguments);
    };

    // Initialize the autocomplete tool
    $.fn.autocomplete = autocomplete;

    // Initialize caretPosition
    $.fn.caret = caret;
    $.fn.caretPosition = caretPosition;

    jqueryPluginsConfigured = true;
  },
};
