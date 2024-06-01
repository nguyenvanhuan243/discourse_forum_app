# frozen_string_literal: true

RSpec.describe Jobs::BulkInvite do
  describe "#execute" do
    fab!(:user)
    fab!(:admin)
    fab!(:east_coast_user)
    fab!(:group1) { Fabricate(:group, name: "group1") }
    fab!(:group2) { Fabricate(:group, name: "group2") }
    fab!(:topic)
    let(:staged_user) { Fabricate(:user, staged: true, active: false) }
    let(:email) { "test@discourse.org" }
    let(:invites) do
      [
        { email: user.email },
        { email: staged_user.email },
        { email: "test2@discourse.org" },
        { email: "test@discourse.org", groups: "GROUP1;group2", topic_id: topic.id },
        { email: "invalid" },
      ]
    end

    def parse_skipped_and_failed_emails(input)
      skipped_invites_emails = input[/Skipped Invites for Emails?:\s+``` text\n(.+?)\n```/m, 1]
      failed_invites_emails = input[/Failed Invites for Emails?:\s+``` text\n(.+?)\n```/m, 1]

      { skipped_invites: skipped_invites_emails, failed_invites: failed_invites_emails }
    end

    it "raises an error when the invites array is missing" do
      expect { Jobs::BulkInvite.new.execute(current_user_id: user.id) }.to raise_error(
        Discourse::InvalidParameters,
        /invites/,
      )
    end

    it "raises an error when current_user_id is not valid" do
      expect { Jobs::BulkInvite.new.execute(invites: invites) }.to raise_error(
        Discourse::InvalidParameters,
        /current_user_id/,
      )
    end

    it "creates the right invites" do
      described_class.new.execute(current_user_id: admin.id, invites: invites)

      expect(Invite.exists?(email: staged_user.email)).to eq(true)
      expect(Invite.exists?(email: "test2@discourse.org")).to eq(true)

      invite = Invite.last
      expect(invite.email).to eq(email)
      expect(invite.invited_groups.pluck(:group_id)).to contain_exactly(group1.id, group2.id)
      expect(invite.topic_invites.pluck(:topic_id)).to contain_exactly(topic.id)

      post = Post.last
      expect(post.raw).to include("3 invites")
      expect(post.raw).to include("1 skipped")
      expect(post.raw).to include("0 warning")
      expect(post.raw).to include("1 error")
    end

    it "handles daylight savings time correctly" do
      # EDT (-04:00) transitions to EST (-05:00) on the first Sunday in November.
      # Freeze time to the last Day of October, so that the creation and expiration date will be in different time zones.
      Time.use_zone("Eastern Time (US & Canada)") do
        freeze_time DateTime.parse("2023-10-31 06:00:00 -0400")
        described_class.new.execute(current_user_id: east_coast_user.id, invites: invites)
        invite = Invite.first
        expect(invite.expires_at.hour).to equal(6)
      end
    end

    it "does not create invited groups for automatic groups" do
      group2.update!(automatic: true)

      described_class.new.execute(current_user_id: admin.id, invites: invites)

      invite = Invite.last
      expect(invite.email).to eq(email)
      expect(invite.invited_groups.pluck(:group_id)).to contain_exactly(group1.id)

      post = Post.last
      expect(post.raw).to include("1 warning")
    end

    it "does not create invited groups record if the user can not manage the group" do
      group1.add_owner(user)

      described_class.new.execute(current_user_id: user.id, invites: invites)

      invite = Invite.last
      expect(invite.email).to eq(email)
      expect(invite.invited_groups.pluck(:group_id)).to contain_exactly(group1.id)
    end

    it "adds existing users to valid groups" do
      existing_user = Fabricate(:user, email: "test@discourse.org")

      group2.update!(automatic: true)

      expect do
        described_class.new.execute(current_user_id: admin.id, invites: invites)
      end.to change { Invite.count }.by(2)

      expect(Invite.exists?(email: staged_user.email)).to eq(true)
      expect(Invite.exists?(email: "test2@discourse.org")).to eq(true)
      expect(existing_user.reload.groups).to eq([group1])
    end

    it "can create staged users and prepopulate user fields" do
      user_field = Fabricate(:user_field, name: "Location")
      user_field_color = Fabricate(:user_field, field_type: "dropdown", name: "Color")
      user_field_color.user_field_options.create!(value: "Red")
      user_field_color.user_field_options.create!(value: "Green")
      user_field_color.user_field_options.create!(value: "Blue")

      described_class.new.execute(
        current_user_id: admin.id,
        invites: [
          { email: "test@discourse.org" }, # new user without user fields
          { email: user.email, location: "value 1", color: "blue" }, # existing user with user fields
          { email: staged_user.email, location: "value 2", color: "redd" }, # existing staged user with user fields
          { email: "test2@discourse.org", location: "value 3" }, # new staged user with user fields
        ],
      )

      expect(Invite.count).to eq(3)
      expect(User.where(staged: true).find_by_email("test@discourse.org")).to eq(nil)
      expect(user.user_fields[user_field.id.to_s]).to eq("value 1")
      expect(user.user_fields[user_field_color.id.to_s]).to eq("Blue")
      expect(staged_user.user_fields[user_field.id.to_s]).to eq("value 2")
      expect(staged_user.user_fields[user_field_color.id.to_s]).to eq(nil)
      new_staged_user = User.where(staged: true).find_by_email("test2@discourse.org")
      expect(new_staged_user.user_fields[user_field.id.to_s]).to eq("value 3")
    end

    it "includes any skipped and failed emails in the private message" do
      described_class.new.execute(
        current_user_id: admin.id,
        invites: [{ email: "bad_email" }, { email: user.email }, { email: "test@discourse.org" }],
      )

      post = Post.last
      result = parse_skipped_and_failed_emails(post.raw)
      expect(result[:skipped_invites]).to eq(user.email)
      expect(result[:failed_invites]).to eq("bad_email")
    end

    context "when there are more than 200 invites" do
      let(:bulk_invites) { [] }

      before { 202.times { |i| bulk_invites << { email: "test_#{i}@discourse.org" } } }

      it "rate limits email sending" do
        described_class.new.execute(current_user_id: admin.id, invites: bulk_invites)

        invite = Invite.last
        expect(invite.email).to eq("test_201@discourse.org")
        expect(invite.emailed_status).to eq(Invite.emailed_status_types[:bulk_pending])
        expect(Jobs::ProcessBulkInviteEmails.jobs.size).to eq(1)
      end
    end

    it "does not send an invite email when skip_email_bulk_invites is true" do
      SiteSetting.skip_email_bulk_invites = true

      described_class.new.execute(current_user_id: admin.id, invites: invites)

      invite = Invite.last
      expect(invite.emailed_status).to eq(Invite.emailed_status_types[:not_required])
    end
  end
end
