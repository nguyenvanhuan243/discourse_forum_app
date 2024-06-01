import { withPluginApi } from "discourse/lib/plugin-api";

const MENTION = 29;
const MESSAGE = 30;
const CHAT_NOTIFICATION_TYPES = [MENTION, MESSAGE];

export default {
  name: "chat-audio",

  initialize(container) {
    const chat = container.lookup("service:chat");

    if (!chat.userCanChat) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      api.registerDesktopNotificationHandler((data, siteSettings, user) => {
        if (user.isInDoNotDisturb()) {
          return;
        }

        if (!user.chat_sound) {
          return;
        }

        if (CHAT_NOTIFICATION_TYPES.includes(data.notification_type)) {
          const chatAudioManager = container.lookup(
            "service:chat-audio-manager"
          );
          chatAudioManager.play(user.chat_sound);
        }
      });
    });
  },
};
