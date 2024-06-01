# frozen_string_literal: true

module PageObjects
  module Pages
    class AdminWatchedWords < PageObjects::Pages::Base
      def visit
        page.visit "admin/customize/watched_words"
        self
      end

      def add_word(word)
        ww = page.find("#watched-words")
        ww.find("#watched-words-header").click
        ww.find(".filter-input").send_keys(word)
        ww.find(".select-kit-row").click

        page.find(".watched-words-detail .btn-primary").click
      end

      def has_word?
        has_css?(".watched-words-detail .show-words-checkbox")
      end
    end
  end
end
