# frozen_string_literal: true

module PageObjects
  module Components
    module Chat
      class Message < PageObjects::Components::Base
        attr_reader :context
        attr_reader :component

        SELECTOR = ".chat-message-container"

        def initialize(context)
          @context = context
        end

        def does_not_exist?(**args)
          exists?(**args, does_not_exist: true)
        end

        def hover
          component.hover
        end

        def open_more_menu
          hover
          click_more_button
        end

        def expand
          component.find(".chat-message-expand").click
        end

        def secondary_action(action)
          if page.has_css?("html.mobile-view", wait: 0)
            component.find(".chat-message-text").click(delay: 0.6)
            page.find(".chat-message-actions [data-id=\"#{action}\"]").click
          else
            open_more_menu
            page.find("[data-value='#{action}']").click
          end
        end

        def select(shift: false)
          if component[:class].include?("-selectable")
            message_selector = component.find(".chat-message-selector")
            if shift
              message_selector.click(:shift)
            else
              message_selector.click
            end

            return
          end

          secondary_action("select")
        end

        def find(**args)
          selector = build_selector(**args)
          text = args[:text]
          text = I18n.t("js.chat.deleted", count: args[:deleted]) if args[:deleted]

          @component =
            page.find("#{context} #{selector}", text: text ? /#{Regexp.escape(text)}/ : nil)

          self
        end

        def exists?(**args)
          selector = build_selector(**args)
          text = args[:text]
          text = I18n.t("js.chat.deleted", count: args[:deleted]) if args[:deleted]

          selector_method = args[:does_not_exist] ? :has_no_selector? : :has_selector?

          if text
            page.find(context).send(
              selector_method,
              selector + " " + ".chat-message-text",
              exact_text: text,
            )
          else
            page.find(context).send(selector_method, selector)
          end
        end

        private

        def click_more_button
          page.find(".more-buttons").click
        end

        def build_selector(**args)
          selector = SELECTOR

          if args[:not_processed]
            selector += ".-not-processed"
          else
            selector += ".-processed.-persisted"
          end

          selector += "[data-id=\"#{args[:id]}\"]" if args[:id]
          selector += ".-selected" if args[:selected]
          selector += ".-persisted" if args[:persisted]
          selector += ".-staged" if args[:staged]
          selector += ".-deleted" if args[:deleted]
          selector += ".-highlighted" if args[:highlighted]
          selector
        end
      end
    end
  end
end
