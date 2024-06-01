# frozen_string_literal: true

module TurboTests
  class ProgressFormatter < ::TurboTests::BaseFormatter
    LINE_LENGTH = 80

    RSpec::Core::Formatters.register(
      self,
      :example_passed,
      :example_pending,
      :example_failed,
      :start_dump,
    )

    def initialize(*args)
      super
      @examples = 0
    end

    def example_passed(_notification)
      output.print RSpec::Core::Formatters::ConsoleCodes.wrap(".", :success)
      wrap
    end

    def example_pending(_notification)
      output.print RSpec::Core::Formatters::ConsoleCodes.wrap("*", :pending)
      wrap
    end

    def example_failed(_notification)
      output.print RSpec::Core::Formatters::ConsoleCodes.wrap("F", :failure)
      wrap
    end

    def start_dump(_notification)
      output.puts
    end

    private

    def wrap
      @examples += 1

      if ENV["GITHUB_ACTIONS"] && @examples == LINE_LENGTH
        output.print "\n"
        @examples = 0
      end
    end
  end
end
