# frozen_string_literal: true

module PageObjects
  module Modals
    class Signup < PageObjects::Modals::Base
      def open?
        super && has_css?(".modal.create-account")
      end

      def closed?
        super && has_no_css?(".modal.create-account")
      end

      def open
        visit("/signup")
      end

      def open_from_header
        find(".sign-up-button").click
      end

      def click(selector)
        if page.has_css?("html.mobile-view", wait: 0)
          expect(page).to have_css(".d-modal:not(.is-animating)")
        end
        find(selector).click
      end

      def open_login
        click("#login-link")
      end

      def click_create_account
        click(".modal.create-account .btn-primary")
      end

      def has_password_input?
        has_css?("#new-account-password")
      end

      def has_no_password_input?
        has_no_css?("#new-account-password")
      end

      def fill_input(selector, text)
        if page.has_css?("html.mobile-view", wait: 0)
          expect(page).to have_css(".d-modal:not(.is-animating)")
        end
        find(selector).fill_in(with: text)
      end

      def fill_email(email)
        fill_input("#new-account-email", email)
      end

      def fill_username(username)
        fill_input("#new-account-username", username)
      end

      def fill_name(name)
        fill_input("#new-account-name", name)
      end

      def fill_password(password)
        fill_input("#new-account-password", password)
      end

      def fill_code(code)
        fill_input("#inviteCode", code)
      end

      def fill_custom_field(name, value)
        find(".user-field-#{name.downcase} input").fill_in(with: value)
      end

      def has_valid_email?
        find(".create-account-email").has_css?("#account-email-validation.good")
      end

      def has_valid_username?
        find(".create-account__username").has_css?("#username-validation.good")
      end

      def has_valid_password?
        find(".create-account__password").has_css?("#password-validation.good")
      end

      def has_valid_fields?
        has_valid_email?
        has_valid_username?
        has_valid_password?
      end

      def click_social_button(provider)
        click(".btn-social.#{provider}")
      end
    end
  end
end
