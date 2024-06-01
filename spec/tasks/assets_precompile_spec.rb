# frozen_string_literal: true

RSpec.describe "assets:precompile" do
  before do
    Rake::Task.clear
    Discourse::Application.load_tasks
  end

  describe "assets:precompile:theme_transpiler" do
    it "compiles the js processor" do
      path = Rake::Task["assets:precompile:theme_transpiler"].actions.first.call

      expect(path).to match(%r{tmp/theme-transpiler})
      expect(File.exist?(path)).to eq(true)
    end
  end
end
