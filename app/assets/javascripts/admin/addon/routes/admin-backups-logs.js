import EmberObject from "@ember/object";
import Route from "@ember/routing/route";
import PreloadStore from "discourse/lib/preload-store";

export default class AdminBackupsLogsRoute extends Route {
  // since the logs are pushed via the message bus
  // we only want to preload them (hence the beforeModel hook)
  beforeModel() {
    const logs = this.controllerFor("adminBackupsLogs").get("logs");
    // preload the logs if any
    PreloadStore.getAndRemove("logs").then(function (preloadedLogs) {
      if (preloadedLogs && preloadedLogs.length) {
        // we need to filter out message like: "[SUCCESS]"
        // and convert POJOs to Ember Objects
        const newLogs = preloadedLogs
          .filter((log) => {
            return log.message.length > 0 && log.message[0] !== "[";
          })
          .map((log) => EmberObject.create(log));
        logs.pushObjects(newLogs);
      }
    });
  }

  setupController() {
    /* prevent default behavior */
  }
}
