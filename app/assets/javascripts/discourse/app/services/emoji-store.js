import Service from "@ember/service";
import { disableImplicitInjections } from "discourse/lib/implicit-injections";
import KeyValueStore from "discourse/lib/key-value-store";

const EMOJI_USAGE = "emojiUsage";
const EMOJI_SELECTED_DIVERSITY = "emojiSelectedDiversity";
const TRACKED_EMOJIS = 15;
const STORE_NAMESPACE = "discourse_emojis_";

@disableImplicitInjections
export default class EmojiStore extends Service {
  store = new KeyValueStore(STORE_NAMESPACE);

  constructor() {
    super(...arguments);

    if (!this.store.getObject(EMOJI_USAGE)) {
      this.favorites = [];
    }
  }

  get diversity() {
    return this.store.getObject(EMOJI_SELECTED_DIVERSITY) || 1;
  }

  set diversity(value) {
    this.store.setObject({ key: EMOJI_SELECTED_DIVERSITY, value: value || 1 });
    this.notifyPropertyChange("diversity");
  }

  get favorites() {
    return this.store.getObject(EMOJI_USAGE) || [];
  }

  set favorites(value) {
    this.store.setObject({ key: EMOJI_USAGE, value: value || [] });
    this.notifyPropertyChange("favorites");
  }

  track(code) {
    const normalizedCode = code.replace(/(^:)|(:$)/g, "");
    const recent = this.favorites.filter((r) => r !== normalizedCode);
    recent.unshift(normalizedCode);
    recent.length = Math.min(recent.length, TRACKED_EMOJIS);
    this.favorites = recent;
  }

  reset() {
    this.store.setObject({ key: EMOJI_USAGE, value: [] });
    this.store.setObject({ key: EMOJI_SELECTED_DIVERSITY, value: 1 });
  }
}
