import { computed } from "@ember/object";
import I18n from "discourse-i18n";
import DropdownSelectBoxComponent from "select-kit/components/dropdown-select-box";

export default DropdownSelectBoxComponent.extend({
  classNames: ["token-based-auth-dropdown"],

  selectKitOptions: {
    icon: "wrench",
    showFullTitle: false,
  },

  content: computed(function () {
    return [
      {
        id: "edit",
        icon: "pencil-alt",
        name: I18n.t("user.second_factor.edit"),
      },
      {
        id: "disable",
        icon: "trash-alt",
        name: I18n.t("user.second_factor.disable"),
      },
    ];
  }),

  actions: {
    onChange(id) {
      switch (id) {
        case "edit":
          this.editSecondFactor(this.totp);
          break;
        case "disable":
          this.disableSingleSecondFactor(this.totp);
          break;
      }
    },
  },
});
