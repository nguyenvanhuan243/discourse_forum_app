# frozen_string_literal: true

RSpec.describe "content security policy integration" do
  it "adds the csp headers correctly" do
    Fabricate(:admin) # to avoid 'new installation' screen

    SiteSetting.content_security_policy = false
    get "/"
    expect(response.headers["Content-Security-Policy"]).to eq(nil)

    SiteSetting.content_security_policy = true
    get "/"
    expect(response.headers["Content-Security-Policy"]).to be_present

    expect(response.headers["Content-Security-Policy"]).to match(
      /script-src 'nonce-[^']+' 'strict-dynamic';/,
    )
  end

  context "with different hostnames - legacy" do
    before { SiteSetting.content_security_policy_strict_dynamic = false }

    before do
      SiteSetting.content_security_policy = true
      RailsMultisite::ConnectionManagement.stubs(:current_db_hostnames).returns(
        %w[primary.example.com secondary.example.com],
      )
      RailsMultisite::ConnectionManagement.stubs(:current_hostname).returns("primary.example.com")
    end

    it "works with the primary domain" do
      host! "primary.example.com"
      get "/"
      expect(response.headers["Content-Security-Policy"]).to include("http://primary.example.com")
    end

    it "works with the secondary domain" do
      host! "secondary.example.com"
      get "/"
      expect(response.headers["Content-Security-Policy"]).to include("http://secondary.example.com")
    end

    it "uses the primary domain for unknown hosts" do
      host! "unknown.example.com"
      get "/"
      expect(response.headers["Content-Security-Policy"]).to include("http://primary.example.com")
    end
  end

  context "with different protocols - legacy" do
    before { SiteSetting.content_security_policy_strict_dynamic = false }

    it "forces https when the site setting is enabled" do
      SiteSetting.force_https = true
      get "/"
      expect(response.headers["Content-Security-Policy"]).to include("https://test.localhost")
    end

    it "uses https when the site setting is disabled, but request is ssl" do
      SiteSetting.force_https = false
      https!
      get "/"
      expect(response.headers["Content-Security-Policy"]).to include("https://test.localhost")
    end
  end
end
