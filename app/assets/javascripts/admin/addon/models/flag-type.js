import RestModel from "discourse/models/rest";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "discourse-i18n";

export default class FlagType extends RestModel {
  @discourseComputed("id")
  name(id) {
    return I18n.t(`admin.flags.summary.action_type_${id}`, { count: 1 });
  }
}
