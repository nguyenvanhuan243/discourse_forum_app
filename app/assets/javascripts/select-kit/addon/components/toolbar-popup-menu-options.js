import I18n from "discourse-i18n";
import DropdownSelectBoxComponent from "select-kit/components/dropdown-select-box";

export default DropdownSelectBoxComponent.extend({
  pluginApiIdentifiers: ["toolbar-popup-menu-options"],
  classNames: ["toolbar-popup-menu-options"],

  selectKitOptions: {
    showFullTitle: false,
    filterable: false,
    autoFilterable: false,
    preventHeaderFocus: true,
    customStyle: true,
  },

  modifyContent(contents) {
    return contents
      .map((content) => {
        if (content.condition) {
          return {
            icon: content.icon,
            name: I18n.t(content.label),
            id: { name: content.name, action: content.action },
          };
        }
      })
      .filter(Boolean);
  },
});
