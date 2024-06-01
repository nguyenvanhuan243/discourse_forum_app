import { htmlSafe } from "@ember/template";
import { registerRawHelper } from "discourse-common/lib/helpers";

registerRawHelper("topic-link", topicLink);
export default function topicLink(topic, args = {}) {
  const title = topic.get("fancyTitle");

  const url = topic.linked_post_number
    ? topic.urlForPostNumber(topic.linked_post_number)
    : topic.get("lastUnreadUrl");

  const classes = ["title"];

  if (args.class) {
    args.class.split(" ").forEach((c) => classes.push(c));
  }

  return htmlSafe(
    `<a href='${url}'
        role='heading'
        aria-level='2'
        class='${classes.join(" ")}'
        data-topic-id='${topic.id}'>${title}</a>`
  );
}
