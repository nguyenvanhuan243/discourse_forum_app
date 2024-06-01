import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { array, fn } from "@ember/helper";
import { action } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import { inject as service } from "@ember/service";
import DButton from "discourse/components/d-button";
import DropdownMenu from "discourse/components/dropdown-menu";
import BookmarkModal from "discourse/components/modal/bookmark";
import { popupAjaxError } from "discourse/lib/ajax-error";
import {
  TIME_SHORTCUT_TYPES,
  timeShortcuts,
} from "discourse/lib/time-shortcut";
import icon from "discourse-common/helpers/d-icon";
import i18n from "discourse-common/helpers/i18n";
import I18n from "discourse-i18n";
import DMenu from "float-kit/components/d-menu";

export default class BookmarkMenu extends Component {
  @service modal;
  @service currentUser;
  @service toasts;
  @service site;

  @tracked quicksaved = false;

  bookmarkManager = this.args.bookmarkManager;
  timezone = this.currentUser?.user_option?.timezone || moment.tz.guess();
  timeShortcuts = timeShortcuts(this.timezone);
  bookmarkCreatePromise = null;

  @action
  setReminderShortcuts() {
    this.reminderAtOptions = [
      this.timeShortcuts.twoHours(),
      this.timeShortcuts.tomorrow(),
      this.timeShortcuts.threeDays(),
    ];

    // So the label is a simple 'Custom...'
    const custom = this.timeShortcuts.custom();
    custom.label = "time_shortcut.custom_short";
    this.reminderAtOptions.push(custom);
  }

  get existingBookmark() {
    return this.bookmarkManager.trackedBookmark?.id
      ? this.bookmarkManager.trackedBookmark
      : null;
  }

  get showEditDeleteMenu() {
    return this.existingBookmark && !this.quicksaved;
  }

  get buttonTitle() {
    if (!this.existingBookmark) {
      return I18n.t("bookmarks.not_bookmarked");
    } else {
      if (this.existingBookmark.reminderAt) {
        return I18n.t("bookmarks.created_with_reminder_generic", {
          date: this.existingBookmark.formattedReminder(this.timezone),
          name: this.existingBookmark.name || "",
        });
      } else {
        return I18n.t("bookmarks.created_generic", {
          name: this.existingBookmark.name || "",
        });
      }
    }
  }

  get buttonClasses() {
    let cssClasses = ["bookmark widget-button bookmark-menu__trigger"];

    if (!this.args.showLabel) {
      cssClasses.push("btn-icon no-text");
    } else {
      cssClasses.push("btn-icon-text");
    }

    if (this.args.buttonClasses) {
      cssClasses.push(this.args.buttonClasses);
    }

    if (this.existingBookmark) {
      cssClasses.push("bookmarked");
      if (this.existingBookmark.reminderAt) {
        cssClasses.push("with-reminder");
      }
    }

    return cssClasses.join(" ");
  }

  get buttonIcon() {
    if (this.existingBookmark?.reminderAt) {
      return "discourse-bookmark-clock";
    } else {
      return "bookmark";
    }
  }

  get buttonLabel() {
    if (!this.args.showLabel) {
      return;
    }

    if (this.existingBookmark) {
      return I18n.t("bookmarked.edit_bookmark");
    } else {
      return I18n.t("bookmarked.title");
    }
  }

  @action
  reminderShortcutTimeTitle(option) {
    if (!option.time) {
      return "";
    }
    return option.time.format(I18n.t(option.timeFormatKey));
  }

  @action
  onBookmark() {
    this.bookmarkCreatePromise = this.bookmarkManager.create();
    this.bookmarkCreatePromise
      .then(() => {
        // We show the menu with Edit/Delete options if the bokmark exists,
        // so this "quicksave" will do nothing in that case.
        // NOTE: Need a nicer way to handle this; otherwise as soon as you save
        // a bookmark, it switches to the other Edit/Delete menu.
        this.quicksaved = true;
        this.toasts.success({
          duration: 1500,
          views: ["mobile"],
          data: { message: I18n.t("bookmarks.bookmarked_success") },
        });
      })
      .catch((error) => popupAjaxError(error))
      .finally(() => {
        this.bookmarkCreatePromise = null;
      });
  }

  @action
  onShowMenu() {
    if (!this.existingBookmark) {
      this.onBookmark();
    }
  }

  @action
  onRegisterApi(api) {
    this.dMenu = api;
  }

  @action
  onEditBookmark() {
    this._openBookmarkModal();
  }

  @action
  onCloseMenu() {
    this.quicksaved = false;
  }

  @action
  async onRemoveBookmark() {
    try {
      const response = await this.bookmarkManager.delete();
      this.bookmarkManager.afterDelete(response, this.existingBookmark.id);
      this.toasts.success({
        duration: 1500,
        data: {
          icon: "trash-alt",
          message: I18n.t("bookmarks.deleted_bookmark_success"),
        },
      });
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.dMenu.close();
    }
  }

  @action
  async onChooseReminderOption(option) {
    if (this.bookmarkCreatePromise) {
      await this.bookmarkCreatePromise;
    }

    if (option.id === TIME_SHORTCUT_TYPES.CUSTOM) {
      this._openBookmarkModal();
    } else {
      this.existingBookmark.selectedReminderType = option.id;
      this.existingBookmark.selectedDatetime = option.time;
      this.existingBookmark.reminderAt = option.time;

      try {
        await this.bookmarkManager.save();
        this.toasts.success({
          duration: 1500,
          views: ["mobile"],
          data: { message: I18n.t("bookmarks.reminder_set_success") },
        });
      } catch (error) {
        popupAjaxError(error);
      } finally {
        this.dMenu.close();
      }
    }
  }

  async _openBookmarkModal() {
    this.dMenu.close();

    try {
      const closeData = await this.modal.show(BookmarkModal, {
        model: {
          bookmark: this.existingBookmark,
          afterSave: (savedData) => {
            return this.bookmarkManager.afterSave(savedData);
          },
          afterDelete: (response, bookmarkId) => {
            this.bookmarkManager.afterDelete(response, bookmarkId);
          },
        },
      });
      this.bookmarkManager.afterModalClose(closeData);
    } catch (error) {
      popupAjaxError(error);
    }
  }

  <template>
    <DMenu
      {{didInsert this.setReminderShortcuts}}
      @identifier="bookmark-menu"
      @triggers={{array "click"}}
      class={{this.buttonClasses}}
      @title={{this.buttonTitle}}
      @label={{this.buttonLabel}}
      @icon={{this.buttonIcon}}
      @onClose={{this.onCloseMenu}}
      @onShow={{this.onShowMenu}}
      @onRegisterApi={{this.onRegisterApi}}
      @arrow={{false}}
    >
      <:content>
        <DropdownMenu as |dropdown|>
          {{#unless this.showEditDeleteMenu}}
            <dropdown.item class="bookmark-menu__title">
              {{icon "check-circle"}}
              <span>{{i18n "bookmarks.bookmarked_success"}}</span>
            </dropdown.item>
          {{/unless}}

          {{#if this.showEditDeleteMenu}}
            {{#if this.site.mobileView}}
              <dropdown.item class="bookmark-menu__title">
                {{icon "bookmark"}}
                <span>{{i18n "bookmarks.bookmark"}}</span>
              </dropdown.item>
            {{/if}}

            <dropdown.item
              class="bookmark-menu__row -edit"
              data-menu-option-id="edit"
            >
              <DButton
                @icon="pencil-alt"
                @label="edit"
                @action={{this.onEditBookmark}}
                @class="bookmark-menu__row-btn btn-transparent"
              />
            </dropdown.item>
            <dropdown.item
              class="bookmark-menu__row --remove"
              role="button"
              tabindex="0"
              data-menu-option-id="delete"
            >
              <DButton
                @icon="trash-alt"
                @label="delete"
                @action={{this.onRemoveBookmark}}
                @class="bookmark-menu__row-btn btn-transparent btn-danger"
              />
            </dropdown.item>

          {{else}}
            <dropdown.item class="bookmark-menu__row-title">
              {{i18n "bookmarks.also_set_reminder"}}
            </dropdown.item>

            <dropdown.divider />

            {{#each this.reminderAtOptions as |option|}}
              <dropdown.item
                class="bookmark-menu__row"
                data-menu-option-id={{option.id}}
              >
                <DButton
                  @label={{option.label}}
                  @translatedTitle={{this.reminderShortcutTimeTitle option}}
                  @action={{fn this.onChooseReminderOption option}}
                  @class="bookmark-menu__row-btn btn-transparent"
                />
              </dropdown.item>
            {{/each}}
          {{/if}}
        </DropdownMenu>
      </:content>
    </DMenu>
  </template>
}
