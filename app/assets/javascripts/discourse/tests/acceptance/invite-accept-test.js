import { click, currentURL, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import PreloadStore from "discourse/lib/preload-store";
import pretender, { response } from "discourse/tests/helpers/create-pretender";
import {
  acceptance,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

function setAuthenticationData(hooks, json) {
  hooks.beforeEach(() => {
    const node = document.createElement("meta");
    node.dataset.authenticationData = JSON.stringify(json);
    node.id = "data-authentication";
    document.querySelector("head").appendChild(node);
  });
  hooks.afterEach(() => {
    document
      .querySelector("head")
      .removeChild(document.getElementById("data-authentication"));
  });
}

function preloadInvite({
  link = false,
  email_verified_by_link = false,
  different_external_email = false,
  hidden_email = false,
} = {}) {
  const info = {
    invited_by: {
      id: 123,
      username: "foobar",
      avatar_template: "/user_avatar/localhost/neil/{size}/25_1.png",
      name: "foobar",
      title: "team",
    },
    username: "invited",
    email_verified_by_link,
    different_external_email,
    hidden_email,
  };

  if (link) {
    info.email = "null";
    info.is_invite_link = true;
  } else {
    info.email = "foobar@example.com";
    info.is_invite_link = false;
  }

  PreloadStore.store("invite_info", info);
}

acceptance("Invite accept", function (needs) {
  needs.settings({ full_name_required: true });

  test("email invite link", async function (assert) {
    PreloadStore.store("invite_info", {
      invited_by: {
        id: 123,
        username: "foobar",
        avatar_template: "/user_avatar/localhost/neil/{size}/25_1.png",
        name: "foobar",
        title: "team",
      },
      email: "foobar@example.com",
      username: "invited",
      is_invite_link: false,
    });

    await visit("/invites/my-valid-invite-token");

    assert.ok(
      query(".col-form").innerText.includes(
        I18n.t("invites.social_login_available")
      ),
      "shows social login hint"
    );

    assert.ok(!exists("#new-account-email"), "hides the email input");
  });

  test("invite link", async function (assert) {
    PreloadStore.store("invite_info", {
      invited_by: {
        id: 123,
        username: "neil",
        avatar_template: "/user_avatar/localhost/neil/{size}/25_1.png",
        name: "Neil Lalonde",
        title: "team",
      },
      email: null,
      username: "invited",
      is_invite_link: true,
    });

    await visit("/invites/my-valid-invite-token");

    assert.notOk(
      document.body.classList.contains("has-sidebar-page"),
      "does not display the sidebar on the invites page"
    );

    assert.notOk(
      exists(".d-header"),
      "does not display the site header on the invites page"
    );

    assert.ok(exists("#new-account-email"), "shows the email input");
    assert.ok(exists("#new-account-username"), "shows the username input");
    assert.strictEqual(
      query("#new-account-username").value,
      "invited",
      "username is prefilled"
    );
    assert.ok(exists("#new-account-name"), "shows the name input");
    assert.ok(exists("#new-account-password"), "shows the password input");
    assert.ok(
      exists(".invites-show .btn-primary:disabled"),
      "submit is disabled because name and email is not filled"
    );

    assert.ok(
      exists("#new-account-password[type='password']"),
      "password is masked by default"
    );
    await click(".toggle-password-mask");
    assert.ok(
      exists("#new-account-password[type='text']"),
      "password is unmasked when toggle is clicked"
    );

    await fillIn("#new-account-name", "John Doe");
    assert.ok(
      exists(".invites-show .btn-primary:disabled"),
      "submit is disabled because email is not filled"
    );

    await fillIn("#new-account-email", "john.doe@example.com");
    assert.ok(
      exists(".invites-show .btn-primary:disabled"),
      "submit is disabled because password is not filled"
    );

    await fillIn("#new-account-password", "top$ecretzz");
    assert.notOk(
      exists(".invites-show .btn-primary:disabled"),
      "submit is enabled"
    );

    await fillIn("#new-account-username", "a");
    assert.ok(exists(".username-input .bad"), "username is not valid");
    assert.ok(
      exists(".invites-show .btn-primary:disabled"),
      "submit is disabled"
    );

    await fillIn("#new-account-password", "aaa");
    assert.ok(exists(".password-input .bad"), "password is not valid");
    assert.ok(
      exists(".invites-show .btn-primary:disabled"),
      "submit is disabled"
    );

    await fillIn("#new-account-email", "john.doe@example");
    assert.ok(exists(".email-input .bad"), "email is not valid");
    assert.ok(
      exists(".invites-show .btn-primary:disabled"),
      "submit is disabled"
    );

    await fillIn("#new-account-username", "valid-name");
    await fillIn("#new-account-password", "secur3ty4Y0uAndMe");
    await fillIn("#new-account-email", "john.doe@example.com");
    assert.ok(exists(".username-input .good"), "username is valid");
    assert.ok(exists(".password-input .good"), "password is valid");
    assert.ok(exists(".email-input .good"), "email is valid");
    assert.notOk(
      exists(".invites-show .btn-primary:disabled"),
      "submit is enabled"
    );
  });

  test("invite name is required only if full name is required", async function (assert) {
    preloadInvite();
    await visit("/invites/my-valid-invite-token");
    assert.ok(exists(".name-input .required"), "Full name is required");
  });
});

acceptance("Invite accept when local login is disabled", function (needs) {
  needs.settings({ enable_local_logins: false });

  test("invite link", async function (assert) {
    preloadInvite({ link: true });

    await visit("/invites/my-valid-invite-token");

    assert.ok(exists(".btn-social.facebook"), "shows Facebook login button");
    assert.ok(!exists("form"), "does not display the form");
  });

  test("email invite link", async function (assert) {
    preloadInvite();
    await visit("/invites/my-valid-invite-token");

    assert.ok(exists(".btn-social.facebook"), "shows Facebook login button");
    assert.ok(!exists("form"), "does not display the form");
  });
});

acceptance(
  "Invite accept when DiscourseConnect SSO is enabled and local login is disabled",
  function (needs) {
    needs.settings({
      enable_local_logins: false,
      enable_discourse_connect: true,
    });

    test("invite link", async function (assert) {
      preloadInvite({ link: true });

      await visit("/invites/my-valid-invite-token");

      assert.ok(
        !exists(".btn-social.facebook"),
        "does not show Facebook login button"
      );
      assert.ok(!exists("form"), "does not display the form");
      assert.ok(
        !exists(".email-message"),
        "does not show the email message with the prefilled email"
      );
      assert.ok(exists(".discourse-connect"), "shows the Continue button");
    });

    test("email invite link", async function (assert) {
      preloadInvite();

      await visit("/invites/my-valid-invite-token");

      assert.ok(
        !exists(".btn-social.facebook"),
        "does not show Facebook login button"
      );
      assert.ok(!exists("form"), "does not display the form");
      assert.ok(
        exists(".email-message"),
        "shows the email message with the prefilled email"
      );
      assert.ok(exists(".discourse-connect"), "shows the Continue button");
      assert.ok(
        query(".email-message").innerText.includes("foobar@example.com")
      );
    });
  }
);

acceptance(
  "Invite accept when DiscourseConnect SSO is enabled and local login is enabled (bad config)",
  function (needs) {
    needs.settings({
      enable_local_logins: true,
      enable_discourse_connect: true,
    });

    test("invite link", async function (assert) {
      preloadInvite({ link: true });

      await visit("/invites/my-valid-invite-token");
      assert.ok(!exists("form"), "does not display the form");
    });
  }
);

acceptance("Invite link with authentication data", function (needs) {
  needs.settings({ enable_local_logins: false });

  setAuthenticationData(needs.hooks, {
    auth_provider: "facebook",
    email: "blah@example.com",
    email_valid: true,
    username: "foobar",
    name: "barfoo",
  });

  test("form elements and buttons are correct ", async function (assert) {
    preloadInvite({ link: true });

    await visit("/invites/my-valid-invite-token");

    assert.ok(
      !exists(".btn-social.facebook"),
      "does not show Facebook login button"
    );

    assert.ok(!exists("#new-account-password"), "does not show password field");

    assert.ok(
      exists("#new-account-email[disabled]"),
      "email field is disabled"
    );

    assert.strictEqual(
      query("#account-email-validation").innerText.trim(),
      I18n.t("user.email.authenticated", { provider: "Facebook" })
    );

    assert.strictEqual(
      query("#new-account-username").value,
      "foobar",
      "username is prefilled"
    );

    assert.strictEqual(
      query("#new-account-name").value,
      "barfoo",
      "name is prefilled"
    );
  });
});

acceptance("Email Invite link with authentication data", function (needs) {
  needs.settings({ enable_local_logins: false });

  setAuthenticationData(needs.hooks, {
    auth_provider: "facebook",
    email: "blah@example.com",
    email_valid: true,
    username: "foobar",
    name: "barfoo",
  });

  test("email invite link with authentication data when email does not match", async function (assert) {
    preloadInvite();

    await visit("/invites/my-valid-invite-token");

    assert.strictEqual(
      query("#account-email-validation").innerText.trim(),
      I18n.t("user.email.invite_auth_email_invalid", { provider: "Facebook" })
    );

    assert.ok(!exists("form"), "does not display the form");
  });
});

acceptance(
  "Email Invite link with valid authentication data",
  function (needs) {
    needs.settings({ enable_local_logins: false });

    setAuthenticationData(needs.hooks, {
      auth_provider: "facebook",
      email: "foobar@example.com",
      email_valid: true,
      username: "foobar",
      name: "barfoo",
    });

    test("confirm form and buttons", async function (assert) {
      preloadInvite();

      await visit("/invites/my-valid-invite-token");

      assert.ok(
        !exists(".btn-social.facebook"),
        "does not show Facebook login button"
      );

      assert.ok(
        !exists("#new-account-password"),
        "does not show password field"
      );
      assert.ok(!exists("#new-account-email"), "does not show email field");

      assert.strictEqual(
        query("#account-email-validation").innerText.trim(),
        I18n.t("user.email.authenticated", { provider: "Facebook" })
      );

      assert.strictEqual(
        query("#new-account-username").value,
        "foobar",
        "username is prefilled"
      );

      assert.strictEqual(
        query("#new-account-name").value,
        "barfoo",
        "name is prefilled"
      );
    });
  }
);

acceptance(
  "Email Invite link with different external email address",
  function (needs) {
    needs.settings({ enable_local_logins: false });

    setAuthenticationData(needs.hooks, {
      auth_provider: "facebook",
      email: "foobar+different@example.com",
      email_valid: true,
      username: "foobar",
      name: "barfoo",
    });

    test("display information that email is invalid", async function (assert) {
      preloadInvite({ different_external_email: true, hidden_email: true });

      await visit("/invites/my-valid-invite-token");

      assert.strictEqual(
        query(".bad").textContent.trim(),
        "Your invitation email does not match the email authenticated by Facebook"
      );
    });
  }
);

acceptance(
  "Email Invite link with valid authentication data, valid email token, unverified authentication email",
  function (needs) {
    needs.settings({ enable_local_logins: false });

    setAuthenticationData(needs.hooks, {
      auth_provider: "facebook",
      email: "foobar@example.com",
      email_valid: false,
      username: "foobar",
      name: "barfoo",
    });

    test("confirm form and buttons", async function (assert) {
      preloadInvite({ email_verified_by_link: true });

      await visit("/invites/my-valid-invite-token");

      assert.ok(!exists("#new-account-email"), "does not show email field");

      assert.strictEqual(
        query("#account-email-validation").innerText.trim(),
        I18n.t("user.email.authenticated_by_invite")
      );
    });
  }
);

acceptance(
  "Email Invite link with valid authentication data, no email token, unverified authentication email",
  function (needs) {
    needs.settings({ enable_local_logins: false });

    setAuthenticationData(needs.hooks, {
      auth_provider: "facebook",
      email: "foobar@example.com",
      email_valid: false,
      username: "foobar",
      name: "barfoo",
    });

    test("confirm form and buttons", async function (assert) {
      preloadInvite({ email_verified_by_link: false });

      await visit("/invites/my-valid-invite-token");

      assert.ok(!exists("#new-account-email"), "does not show email field");

      assert.strictEqual(
        query("#account-email-validation").innerText.trim(),
        I18n.t("user.email.ok")
      );
    });
  }
);

acceptance(
  "Invite link with authentication data, and associate link",
  function (needs) {
    needs.settings({ enable_local_logins: false });

    setAuthenticationData(needs.hooks, {
      auth_provider: "facebook",
      email: "blah@example.com",
      email_valid: true,
      username: "foobar",
      name: "barfoo",
      associate_url: "/associate/abcde",
    });

    test("shows the associate link", async function (assert) {
      preloadInvite({ link: true });

      await visit("/invites/my-valid-invite-token");

      assert.ok(
        exists(".create-account-associate-link"),
        "shows the associate account link"
      );
    });
  }
);

acceptance("Associate link", function (needs) {
  needs.user();
  needs.settings({ enable_local_logins: false });

  setAuthenticationData(needs.hooks, {
    auth_provider: "facebook",
    email: "blah@example.com",
    email_valid: true,
    username: "foobar",
    name: "barfoo",
    associate_url: "/associate/abcde",
  });

  test("associates the account", async function (assert) {
    preloadInvite({ link: true });
    pretender.get("/associate/abcde.json", () => {
      return response({
        token: "abcde",
        provider_name: "facebook",
      });
    });

    pretender.post("/associate/abcde", () => {
      return response({ success: true });
    });

    await visit("/invites/my-valid-invite-token");
    assert
      .dom(".create-account-associate-link")
      .exists("shows the associate account link");

    await click(".create-account-associate-link a");
    assert.dom(".d-modal").exists();

    await click(".d-modal .btn-primary");
    assert.strictEqual(currentURL(), "/u/eviltrout/preferences/account");
  });
});

acceptance("Associate link, with an error", function (needs) {
  needs.user();
  needs.settings({ enable_local_logins: false });

  setAuthenticationData(needs.hooks, {
    auth_provider: "facebook",
    email: "blah@example.com",
    email_valid: true,
    username: "foobar",
    name: "barfoo",
    associate_url: "/associate/abcde",
  });

  test("shows the error", async function (assert) {
    preloadInvite({ link: true });
    pretender.get("/associate/abcde.json", () => {
      return response({
        token: "abcde",
        provider_name: "facebook",
      });
    });

    pretender.post("/associate/abcde", () => {
      return response({ error: "sorry, no" });
    });

    await visit("/invites/my-valid-invite-token");
    await click(".create-account-associate-link a");
    await click(".d-modal .btn-primary");

    assert.dom(".d-modal .alert").hasText("sorry, no");
  });
});
