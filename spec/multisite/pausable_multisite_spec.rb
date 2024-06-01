# frozen_string_literal: true

RSpec.describe "Pausing/Unpausing Sidekiq", type: :multisite do
  describe "#pause!, #unpause! and #paused?" do
    it "can pause and unpause" do
      Sidekiq.pause!
      expect(Sidekiq.paused?).to eq(true)

      test_multisite_connection("second") { expect(Sidekiq.paused?).to eq(false) }

      Sidekiq.unpause!

      expect(Sidekiq.paused?).to eq(false)

      test_multisite_connection("second") do
        Sidekiq.pause!("test")
        expect(Sidekiq.paused?).to eq(true)
      end

      expect(Sidekiq.paused_dbs).to eq(["second"])

      Sidekiq.unpause_all!

      RailsMultisite::ConnectionManagement.each_connection { expect(Sidekiq.paused?).to eq(false) }
    end
  end
end

RSpec.describe Sidekiq::Pausable, type: :multisite do
  after { Sidekiq.unpause_all! }

  describe "when sidekiq is paused" do
    let(:middleware) { Sidekiq::Pausable.new }

    def call_middleware(db = RailsMultisite::ConnectionManagement::DEFAULT)
      middleware.call(
        Jobs::PostAlert.new,
        { "args" => [{ "current_site_id" => db }] },
        "critical",
      ) { yield }
    end

    it "should delay the job" do
      Sidekiq.pause!

      called = false
      called2 = false
      call_middleware { called = true }

      expect(called).to eq(false)

      test_multisite_connection("second") do
        call_middleware("second") { called2 = true }
        expect(called2).to eq(true)
      end

      Sidekiq.unpause!
      call_middleware { called = true }

      expect(called).to eq(true)

      test_multisite_connection("second") do
        Sidekiq.pause!
        call_middleware("second") { called2 = false }
        expect(called2).to eq(true)
      end
    end
  end
end
