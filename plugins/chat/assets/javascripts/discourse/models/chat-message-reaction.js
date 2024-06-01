import { tracked } from "@glimmer/tracking";
import { TrackedArray } from "@ember-compat/tracked-built-ins";
import User from "discourse/models/user";

export const REACTIONS = { add: "add", remove: "remove" };

export default class ChatMessageReaction {
  static create(args = {}) {
    return new ChatMessageReaction(args);
  }

  @tracked count = 0;
  @tracked reacted = false;
  @tracked users = [];
  @tracked emoji;

  constructor(args = {}) {
    this.count = args.count;
    this.emoji = args.emoji;
    this.users = this.#initUsersModels(args.users);
    this.reacted = args.reacted;
  }

  #initUsersModels(users = []) {
    return new TrackedArray(
      users.map((user) => {
        if (user instanceof User) {
          return user;
        }

        return User.create(user);
      })
    );
  }
}
