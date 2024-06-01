# frozen_string_literal: true

module PageObjects
  module Components
    class UserMenu < PageObjects::Components::Base
      def open
        find(".header-dropdown-toggle.current-user").click
        has_css?(".user-menu")
        self
      end

      def click_replies_notifications_tab
        click_link("user-menu-button-replies")
        has_css?("#quick-access-replies")
        self
      end

      def click_profile_tab
        click_link("user-menu-button-profile")
        has_css?("#quick-access-profile")
        self
      end

      def click_logout_button
        find("#quick-access-profile .logout .btn").click
        has_css?(".d-header .login-button")
        self
      end

      def sign_out
        open
        click_profile_tab
        click_logout_button
        self
      end

      def has_group_mentioned_notification?(topic, user_that_mentioned_group, group_mentioned)
        expect(find("#quick-access-replies .group-mentioned").text).to eq(
          "#{user_that_mentioned_group.username} @#{group_mentioned.name} #{topic.title}",
        )
      end

      def has_right_replies_button_count?(count)
        expect(find("#user-menu-button-replies").text).to eq(count.to_s)
      end

      def has_notification_count_of?(count)
        page.has_css?(".user-menu li.notification", count: count)
      end
    end
  end
end
