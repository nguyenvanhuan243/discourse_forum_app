import { htmlSafe } from "@ember/template";
import {
  APPROVED,
  DELETED,
  IGNORED,
  PENDING,
  REJECTED,
} from "discourse/models/reviewable";
import { iconHTML } from "discourse-common/lib/icon-library";
import I18n from "discourse-i18n";

function dataFor(status, type) {
  switch (status) {
    case PENDING:
      return { name: "pending" };
    case APPROVED:
      switch (type) {
        case "ReviewableQueuedPost":
          return {
            icon: "check",
            name: "approved_post",
            cssClass: "approved",
          };
        case "ReviewableUser":
          return {
            icon: "check",
            name: "approved_user",
            cssClass: "approved",
          };
        default:
          return {
            icon: "check",
            name: "approved_flag",
            cssClass: "approved",
          };
      }
    case REJECTED:
      switch (type) {
        case "ReviewableQueuedPost":
          return {
            icon: "times",
            name: "rejected_post",
            cssClass: "rejected",
          };
        case "ReviewableUser":
          return {
            icon: "times",
            name: "rejected_user",
            cssClass: "rejected",
          };
        default:
          return {
            icon: "times",
            name: "rejected_flag",
            cssClass: "rejected",
          };
      }
    case IGNORED:
      return {
        icon: "external-link-alt",
        name: "ignored",
      };
    case DELETED:
      return { icon: "trash-alt", name: "deleted" };
  }
}

export function htmlStatus(status, type) {
  let data = dataFor(status, type);
  if (!data) {
    return;
  }

  let icon = data.icon ? iconHTML(data.icon) : "";

  return `
    <span class="${data.cssClass || data.name}">
      ${icon}
      ${I18n.t("review.statuses." + data.name + ".title")}
    </span>
  `;
}

export default function (status, type) {
  return htmlSafe(htmlStatus(status, type));
}
