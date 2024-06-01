# frozen_string_literal: true

module PageObjects
  module Pages
    class AdminUserFields < PageObjects::Pages::Base
      def visit
        page.visit "admin/customize/user_fields"
        self
      end

      def add_field(name: nil, description: nil, requirement: nil, preferences: [])
        page.find(".user-fields .btn-primary").click

        form = page.find(".user-field")

        form.find(".user-field-name").fill_in(with: name)
        form.find(".user-field-desc").fill_in(with: description)
        form.find(".save").click
      end

      def has_user_field?(name)
        page.has_text?(name)
      end
    end
  end
end
