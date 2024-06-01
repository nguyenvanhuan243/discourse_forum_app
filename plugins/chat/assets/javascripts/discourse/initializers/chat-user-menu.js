import { withPluginApi } from "discourse/lib/plugin-api";
import { formatUsername } from "discourse/lib/utilities";
import getURL from "discourse-common/lib/get-url";
import I18n from "discourse-i18n";
import slugifyChannel from "discourse/plugins/chat/discourse/lib/slugify-channel";

export default {
  name: "chat-user-menu",
  initialize(container) {
    withPluginApi("1.3.0", (api) => {
      const chat = container.lookup("service:chat");

      if (!chat.userCanChat) {
        return;
      }

      if (api.registerNotificationTypeRenderer) {
        api.registerNotificationTypeRenderer(
          "chat_invitation",
          (NotificationItemBase) => {
            return class extends NotificationItemBase {
              linkTitle = I18n.t("notifications.titles.chat_invitation");
              icon = "link";
              description = I18n.t("notifications.chat_invitation");

              get linkHref() {
                const data = this.notification.data;
                const slug = slugifyChannel({
                  title: data.chat_channel_title,
                  slug: data.chat_channel_slug,
                });

                let url = `/chat/c/${slug || "-"}/${data.chat_channel_id}`;

                if (data.chat_message_id) {
                  url += `/${data.chat_message_id}`;
                }

                return getURL(url);
              }

              get label() {
                return formatUsername(
                  this.notification.data.invited_by_username
                );
              }
            };
          }
        );

        api.registerNotificationTypeRenderer(
          "chat_mention",
          (NotificationItemBase) => {
            return class extends NotificationItemBase {
              get linkHref() {
                const slug = slugifyChannel({
                  title: this.notification.data.chat_channel_title,
                  slug: this.notification.data.chat_channel_slug,
                });

                let notificationRoute = `/chat/c/${slug || "-"}/${
                  this.notification.data.chat_channel_id
                }`;
                if (this.notification.data.chat_thread_id) {
                  notificationRoute += `/t/${this.notification.data.chat_thread_id}`;
                } else {
                  notificationRoute += `/${this.notification.data.chat_message_id}`;
                }
                return getURL(notificationRoute);
              }

              get linkTitle() {
                return I18n.t("notifications.titles.chat_mention");
              }

              get icon() {
                return "d-chat";
              }

              get label() {
                return formatUsername(
                  this.notification.data.mentioned_by_username
                );
              }

              get description() {
                const identifier = this.notification.data.identifier
                  ? `@${this.notification.data.identifier}`
                  : null;

                const i18nPrefix = this.notification.data
                  .is_direct_message_channel
                  ? "notifications.popup.direct_message_chat_mention"
                  : "notifications.popup.chat_mention";

                const i18nSuffix = identifier ? "other_plain" : "direct";

                return I18n.t(`${i18nPrefix}.${i18nSuffix}`, {
                  identifier,
                  channel: this.notification.data.chat_channel_title,
                });
              }
            };
          }
        );
      }

      if (api.registerUserMenuTab) {
        api.registerUserMenuTab((UserMenuTab) => {
          return class extends UserMenuTab {
            get id() {
              return "chat-notifications";
            }

            get panelComponent() {
              return "user-menu/chat-notifications-list";
            }

            get icon() {
              return "d-chat";
            }

            get count() {
              return (
                this.getUnreadCountForType("chat_mention") +
                this.getUnreadCountForType("chat_invitation")
              );
            }

            get notificationTypes() {
              return [
                "chat_invitation",
                "chat_mention",
                "chat_message",
                "chat_quoted",
              ];
            }
          };
        });
      }
    });
  },
};
