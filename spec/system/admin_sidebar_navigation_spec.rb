# frozen_string_literal: true

describe "Admin Revamp | Sidebar Navigation", type: :system do
  fab!(:admin)
  fab!(:moderator)

  let(:sidebar) { PageObjects::Components::NavigationMenu::Sidebar.new }
  let(:sidebar_dropdown) { PageObjects::Components::SidebarHeaderDropdown.new }
  let(:filter) { PageObjects::Components::Filter.new }

  before do
    SiteSetting.navigation_menu = "sidebar"
    SiteSetting.admin_sidebar_enabled_groups = [
      Group::AUTO_GROUPS[:admins],
      Group::AUTO_GROUPS[:moderators],
    ]

    sign_in(admin)
  end

  it "shows the sidebar when navigating to an admin route and hides it when leaving" do
    visit("/latest")
    expect(sidebar).to have_section("categories")
    sidebar.click_link_in_section("community", "admin")
    expect(page).to have_current_path("/admin")
    expect(sidebar).to be_visible
    expect(sidebar).to have_no_section("categories")
    expect(page).to have_no_css(".admin-main-nav")
    filter.click_back_to_forum
    expect(page).to have_current_path("/latest")
    expect(sidebar).to have_no_section("admin-root")
  end

  it "collapses sections by default" do
    visit("/admin")
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(2)
    expect(links.map(&:text)).to eq(["Dashboard", "All Site Settings"])
  end

  it "respects the user homepage preference for the Back to Forum link" do
    admin.user_option.update!(
      homepage_id: UserOption::HOMEPAGES.find { |id, value| value == "categories" }.first,
    )
    visit("/admin")
    expect(page).to have_link("Back to Forum", href: "/categories")
  end

  context "when on mobile" do
    it "shows the admin sidebar links in the header-dropdown when navigating to an admin route and hides them when leaving",
       mobile: true do
      visit("/latest")
      sidebar_dropdown.click
      expect(sidebar).to have_section("community")
      sidebar.click_link_in_section("community", "admin")
      expect(page).to have_current_path("/admin")
      sidebar_dropdown.click
      expect(sidebar).to have_no_section("community")
      expect(page).to have_no_css(".admin-main-nav")
      filter.click_back_to_forum
      expect(page).to have_current_path("/latest")
      sidebar_dropdown.click
      expect(sidebar).to have_no_section("admin-root")
    end
  end

  context "when the setting is disabled" do
    before { SiteSetting.admin_sidebar_enabled_groups = "" }

    it "does not show the admin sidebar" do
      visit("/latest")
      sidebar.click_link_in_section("community", "admin")
      expect(page).to have_current_path("/admin")
      expect(sidebar).to have_no_section("admin-root")
    end
  end

  it "allows links to be filtered" do
    visit("/admin")
    sidebar.toggle_all_sections
    all_links_count = page.all(".sidebar-section-link-content-text").count

    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(all_links_count)
    expect(page).to have_no_css(".sidebar-no-results")

    filter.filter("ie")
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(2)
    expect(links.map(&:text)).to eq(["User Fields", "Preview Summary"])
    expect(page).to have_no_css(".sidebar-no-results")

    filter.filter("ieeee")
    expect(page).to have_no_css(".sidebar-section-link-content-text")
    expect(page).to have_css(".sidebar-no-results")

    filter.clear
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(all_links_count)
    expect(page).to have_no_css(".sidebar-no-results")
    expect(page).to have_css(".sidebar-sections__back-to-forum")

    # When match section title, display all links
    filter.filter("Email Sett")
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(3)
    expect(links.map(&:text)).to eq(["Appearance", "Preview Summary", "Server Setup"])
  end

  it "allows further filtering of site settings or users if links do not show results" do
    user_1 = Fabricate(:user, username: "moltisanti", name: "Christopher Moltisanti")
    user_2 = Fabricate(:user, username: "bevelaqua", name: "Matthew Bevelaqua")

    visit("/admin")
    filter.filter("user locale")
    find(".sidebar-additional-filter-settings").click
    expect(page).to have_current_path(
      "/admin/site_settings/category/all_results?filter=user%20locale",
    )
    expect(page).to have_content(I18n.t("site_settings.allow_user_locale"))

    filter.filter("log_search_queries")
    find(".sidebar-additional-filter-settings").click
    expect(page).to have_current_path(
      "/admin/site_settings/category/all_results?filter=log_search_queries",
    )
    expect(page).to have_content(I18n.t("site_settings.log_search_queries"))

    filter.filter("bevelaqua")
    find(".sidebar-additional-filter-users").click
    expect(page).to have_current_path("/admin/users/list/active?username=bevelaqua")
    expect(find(".users-list-container")).to have_content("bevelaqua")

    filter.filter("moltisanti")
    find(".sidebar-additional-filter-users").click
    expect(page).to have_current_path("/admin/users/list/active?username=moltisanti")
    expect(find(".users-list-container")).to have_content("moltisanti")
  end

  it "allows sections to be expanded" do
    visit("/admin")
    sidebar.toggle_all_sections
    all_links_count = page.all(".sidebar-section-link-content-text").count
    sidebar.toggle_all_sections

    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(2)
    expect(links.map(&:text)).to eq(["Dashboard", "All Site Settings"])

    sidebar.toggle_all_sections
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(all_links_count)
  end

  it "accepts hidden keywords like installed plugin names for filter" do
    Discourse.instance_variable_set(
      "@plugins",
      Plugin::Instance.find_all("#{Rails.root}/spec/fixtures/plugins"),
    )

    visit("/admin")
    sidebar.toggle_all_sections
    filter.filter("csp_extension")
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(1)
    expect(links.map(&:text)).to eq(["Installed"])
  end

  it "accepts components and themes keywords for filter" do
    Fabricate(:theme, name: "Air theme", component: false)
    Fabricate(:theme, name: "Kanban", component: true)

    visit("/admin")
    sidebar.toggle_all_sections

    filter.filter("air")
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(1)
    expect(links.map(&:text)).to eq(["Themes"])

    filter.filter("kanban")
    links = page.all(".sidebar-section-link-content-text")
    expect(links.count).to eq(1)
    expect(links.map(&:text)).to eq(["Components"])
  end

  it "does not show the button to customize sidebar sections, that is only supported in the main panel" do
    visit("/")
    expect(sidebar).to have_add_section_button
    visit("/admin")
    expect(sidebar).to have_no_add_section_button
  end

  it "displays limited links for moderator" do
    sign_in(moderator)
    visit("/admin")

    sidebar.toggle_all_sections

    links = page.all(".sidebar-section-link-content-text")
    expect(links.map(&:text)).to eq(
      [
        "Dashboard",
        "What's New",
        "All",
        "Users",
        "Watched Words",
        "Screened Emails",
        "Screened IPs",
        "Screened URLs",
        "Search Logs",
        "Staff Action Logs",
      ],
    )
  end
end
