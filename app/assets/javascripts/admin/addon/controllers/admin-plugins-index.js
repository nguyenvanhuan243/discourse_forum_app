import Controller from "@ember/controller";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";
import SiteSetting from "admin/models/site-setting";

export default class AdminPluginsIndexController extends Controller {
  @service session;

  @action
  async togglePluginEnabled(plugin) {
    const oldValue = plugin.enabled;
    const newValue = !oldValue;

    try {
      plugin.enabled = newValue;
      await SiteSetting.update(plugin.enabledSetting, newValue);
      this.session.requiresRefresh = true;
    } catch (e) {
      plugin.enabled = oldValue;
      popupAjaxError(e);
    }
  }
}
