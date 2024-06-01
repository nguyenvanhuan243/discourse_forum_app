# frozen_string_literal: true

describe "JS Deprecation Handling", type: :system do
  it "can successfully print a deprecation message after applying production-mode shims" do
    visit("/latest")
    expect(find("#main-outlet-wrapper")).to be_visible

    # Intercept console.warn so we can enumerate calls later
    page.execute_script <<~JS
      window.intercepted_warnings = [];
      console.warn = (msg) => window.intercepted_warnings.push([msg, (new Error()).stack])
    JS

    # Apply deprecate shims. These are applied automatically in production
    # builds, but running a full production build for system specs would be
    # too slow
    page.execute_script <<~JS
      require("discourse/lib/deprecate-shim").applyShim();
    JS

    # Trigger a deprecation, then return the console.warn calls
    warn_calls = page.execute_script <<~JS
      const { deprecate } = require('@ember/debug');
      deprecate("Some message", false, { id: "some.id" })
      return window.intercepted_warnings
    JS

    expect(warn_calls.size).to eq(1)
    call, backtrace = warn_calls[0]

    expect(call).to eq("DEPRECATION: Some message [deprecation id: some.id]")
    expect(backtrace).to include("shimLogDeprecationToConsole")
  end

  it "shows warnings to admins for critical deprecations" do
    sign_in Fabricate(:admin)

    SiteSetting.warn_critical_js_deprecations = true
    SiteSetting.warn_critical_js_deprecations_message =
      "Discourse core changes will be applied to your site on Jan 15."

    visit("/latest")

    page.execute_script <<~JS
      const deprecated = require("discourse-common/lib/deprecated").default;
      deprecated("Fake deprecation message", { id: "fake-deprecation" })
    JS

    message = find("#global-notice-critical-deprecation")
    expect(message).to have_text(
      "One of your themes or plugins needs updating for compatibility with upcoming Discourse core changes",
    )
    expect(message).to have_text(SiteSetting.warn_critical_js_deprecations_message)
  end
end
