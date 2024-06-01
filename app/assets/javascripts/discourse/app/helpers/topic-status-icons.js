import ArrayProxy from "@ember/array/proxy";

class TopicStatusIconArrayProxy extends ArrayProxy {
  render(topic, renderIcon) {
    const renderIconIf = (conditionProp, name, key) => {
      if (!topic.get(conditionProp)) {
        return;
      }
      renderIcon(name, key);
    };

    if (topic.get("closed") && topic.get("archived")) {
      renderIcon("lock", "locked_and_archived");
    } else {
      renderIconIf("closed", "lock", "locked");
      renderIconIf("archived", "lock", "archived");
    }

    this.forEach((args) => renderIconIf(...args));
  }
}

export default TopicStatusIconArrayProxy.create({
  content: [
    ["is_warning", "envelope", "warning"],
    ["pinned", "thumbtack", "pinned"],
    ["unpinned", "thumbtack", "unpinned"],
    ["invisible", "far-eye-slash", "unlisted"],
  ],
});
