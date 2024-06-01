import I18n from "discourse-i18n";
import ComboBoxComponent from "select-kit/components/combo-box";

export default ComboBoxComponent.extend({
  pluginApiIdentifiers: ["color-palettes"],
  classNames: ["color-palettes"],

  modifyComponentForRow() {
    return "color-palettes/color-palettes-row";
  },

  selectKitOptions: {
    translatedNone: I18n.t("admin.customize.theme.default_light_scheme"),
  },
});
