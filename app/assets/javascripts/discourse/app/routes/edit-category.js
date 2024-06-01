import { service } from "@ember/service";
import Category from "discourse/models/category";
import DiscourseRoute from "discourse/routes/discourse";
import I18n from "discourse-i18n";

export default DiscourseRoute.extend({
  router: service(),

  model(params) {
    return this.site.lazy_load_categories
      ? Category.asyncFindBySlugPath(params.slug, { includePermissions: true })
      : Category.reloadCategoryWithPermissions(params, this.store, this.site);
  },

  afterModel(model) {
    if (!model.can_edit) {
      this.router.replaceWith("/404");
      return;
    }
  },

  titleToken() {
    return I18n.t("category.edit_dialog_title", {
      categoryName: this.currentModel.name,
    });
  },
});
