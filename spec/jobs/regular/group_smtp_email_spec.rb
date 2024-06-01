# frozen_string_literal: true

RSpec.describe Jobs::GroupSmtpEmail do
  subject(:job) { described_class.new }

  fab!(:topic) { Fabricate(:private_message_topic, title: "Help I need support") }
  fab!(:post) do
    Fabricate(:post, topic: topic, raw: "some first post content")
    Fabricate(:post, topic: topic, raw: "some intermediate content")
    Fabricate(:post, topic: topic, raw: "this is the second post reply")
  end
  fab!(:group) { Fabricate(:smtp_group, name: "support-group", full_name: "Support Group") }
  fab!(:recipient_user) { Fabricate(:user, email: "test@test.com") }
  let(:post_id) { post.id }
  let(:args) do
    {
      group_id: group.id,
      post_id: post_id,
      email: "test@test.com",
      cc_emails: %w[otherguy@test.com cormac@lit.com],
    }
  end
  let(:staged1) { Fabricate(:staged, email: "otherguy@test.com") }
  let(:staged2) { Fabricate(:staged, email: "cormac@lit.com") }
  let(:normal_user) { Fabricate(:user, email: "justanormalguy@test.com", username: "normal_user") }

  before do
    SiteSetting.enable_smtp = true
    SiteSetting.manual_polling_enabled = true
    SiteSetting.reply_by_email_address = "test+%{reply_key}@test.com"
    SiteSetting.reply_by_email_enabled = true
    TopicAllowedGroup.create(group: group, topic: topic)
    TopicAllowedUser.create(user: recipient_user, topic: topic)
    TopicAllowedUser.create(user: staged1, topic: topic)
    TopicAllowedUser.create(user: staged2, topic: topic)
    TopicAllowedUser.create(user: normal_user, topic: topic)
  end

  it "sends an email using the GroupSmtpMailer and Email::Sender" do
    message = Mail::Message.new(body: "hello", to: "myemail@example.invalid")
    GroupSmtpMailer
      .expects(:send_mail)
      .with(
        group,
        "test@test.com",
        post,
        cc_addresses: %w[otherguy@test.com cormac@lit.com],
        bcc_addresses: [],
      )
      .returns(message)
    job.execute(args)
  end

  it "includes a 'reply above this line' message" do
    job.execute(args)
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    expect(email_log.as_mail_message.html_part.to_s).to include(
      I18n.t("user_notifications.reply_above_line"),
    )
  end

  it "does not include context posts" do
    job.execute(args)
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    expect(email_log.as_mail_message.text_part.to_s).not_to include(
      I18n.t("user_notifications.previous_discussion"),
    )
    expect(email_log.as_mail_message.text_part.to_s).not_to include("some first post content")
  end

  it "does not include in reply to post in email but still has the header" do
    second_post = topic.posts.find_by(post_number: 2)
    post.update!(reply_to_post_number: 1, reply_to_user: second_post.user)
    PostReply.create(post: second_post, reply: post)
    job.execute(args)
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    expect(email_log.raw_headers).to include(
      "In-Reply-To: <discourse/post/#{second_post.id}@#{Email::Sender.host_for(Discourse.base_url)}>",
    )
    expect(email_log.as_mail_message.html_part.to_s).not_to include(
      I18n.t("user_notifications.in_reply_to"),
    )
  end

  it "includes the participants in the correct format (but not the recipient user), and does not have links for the staged users" do
    job.execute(args)
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    email_text = email_log.as_mail_message.text_part.to_s
    expect(email_text).to include("Support Group")
    expect(email_text).to include("otherguy@test.com")
    expect(email_text).not_to include("[otherguy@test.com]")
    expect(email_text).to include("cormac@lit.com")
    expect(email_text).not_to include("[cormac@lit.com]")
    expect(email_text).to include("normal_user")
    expect(email_text).not_to include(recipient_user.username)
  end

  it "creates an EmailLog record with the correct details" do
    job.execute(args)
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    expect(email_log).not_to eq(nil)
    expect(email_log.message_id).to eq("discourse/post/#{post.id}@test.localhost")
  end

  it "creates an IncomingEmail record with the correct details to avoid double processing IMAP" do
    job.execute(args)
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(ActionMailer::Base.deliveries.last.subject).to eq("Re: Help I need support")
    incoming_email =
      IncomingEmail.find_by(post_id: post.id, topic_id: post.topic_id, user_id: post.user.id)
    expect(incoming_email).not_to eq(nil)
    expect(incoming_email.message_id).to eq("discourse/post/#{post.id}@test.localhost")
    expect(incoming_email.created_via).to eq(IncomingEmail.created_via_types[:group_smtp])
    expect(incoming_email.to_addresses).to eq("test@test.com")
    expect(incoming_email.cc_addresses).to eq("otherguy@test.com;cormac@lit.com")
    expect(incoming_email.subject).to eq("Re: Help I need support")
  end

  it "does not create a post reply key, it always replies to the group email_username" do
    job.execute(args)
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(ActionMailer::Base.deliveries.last.subject).to eq("Re: Help I need support")
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    post_reply_key = PostReplyKey.where(user_id: recipient_user, post_id: post.id).first
    expect(post_reply_key).to eq(nil)
    expect(email_log.raw_headers).not_to include("Reply-To: Support Group <#{group.email_username}")
    expect(email_log.raw_headers).to include("From: Support Group <#{group.email_username}")
  end

  it "creates an EmailLog record with the correct details" do
    job.execute(args)
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(ActionMailer::Base.deliveries.last.subject).to eq("Re: Help I need support")
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    expect(email_log).not_to eq(nil)
    expect(email_log.message_id).to eq("discourse/post/#{post.id}@test.localhost")
  end

  it "does not create a post reply key, it always replies to the group email_username" do
    job.execute(args)
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(ActionMailer::Base.deliveries.last.subject).to eq("Re: Help I need support")
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    post_reply_key = PostReplyKey.where(user_id: recipient_user, post_id: post.id).first
    expect(post_reply_key).to eq(nil)
    expect(email_log.raw).not_to include("Reply-To: Support Group <#{group.email_username}")
    expect(email_log.raw).to include("From: Support Group <#{group.email_username}")
  end

  it "falls back to the group name if full name is blank" do
    group.update(full_name: "")
    job.execute(args)
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(ActionMailer::Base.deliveries.last.subject).to eq("Re: Help I need support")
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    expect(email_log.raw_headers).to include("From: support-group <#{group.email_username}")
  end

  it "has the group_smtp_id and the to_address filled in correctly" do
    job.execute(args)
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(ActionMailer::Base.deliveries.last.subject).to eq("Re: Help I need support")
    email_log =
      EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
    expect(email_log.to_address).to eq("test@test.com")
    expect(email_log.smtp_group_id).to eq(group.id)
  end

  it "drops malformed cc addresses when sending the email" do
    args2 = args.clone
    args2[:cc_emails] << "somebadccemail@test.com<mailto:somebadccemail@test.com"
    job.execute(args2)
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    last_email = ActionMailer::Base.deliveries.last
    expect(last_email.subject).to eq("Re: Help I need support")
    expect(last_email.cc).to match_array(%w[otherguy@test.com cormac@lit.com])
  end

  it "does not retry the job if the IncomingEmail record is not created because of an error" do
    Jobs.run_immediately!
    IncomingEmail.expects(:create!).raises(StandardError)
    expect { Jobs.enqueue(:group_smtp_email, **args) }.not_to raise_error
  end

  it "does not retry the job on SMTP read timeouts, because we can't be sure if the send actually failed or if ENTER . ENTER just timed out" do
    Jobs.run_immediately!
    Email::Sender.any_instance.expects(:send).raises(Net::ReadTimeout)
    expect { Jobs.enqueue(:group_smtp_email, **args) }.not_to raise_error
  end

  context "when there are cc_addresses" do
    it "has the cc_addresses and cc_user_ids filled in correctly" do
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(1)
      sent_mail = ActionMailer::Base.deliveries.last
      expect(sent_mail.subject).to eq("Re: Help I need support")
      expect(sent_mail.cc).to eq(%w[otherguy@test.com cormac@lit.com])
      email_log =
        EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
      expect(email_log.cc_addresses).to eq("otherguy@test.com;cormac@lit.com")
      expect(email_log.cc_user_ids).to match_array([staged1.id, staged2.id])
    end

    it "where cc_addresses match non-staged users, convert to bcc_addresses" do
      staged2.update!(staged: false, active: true)
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(1)
      sent_mail = ActionMailer::Base.deliveries.last
      expect(sent_mail.subject).to eq("Re: Help I need support")
      expect(sent_mail.cc).to eq(["otherguy@test.com"])
      expect(sent_mail.bcc).to eq(["cormac@lit.com"])
      email_log =
        EmailLog.find_by(post_id: post.id, topic_id: post.topic_id, user_id: recipient_user.id)
      expect(email_log.cc_addresses).to eq("otherguy@test.com")
      expect(email_log.bcc_addresses).to eq("cormac@lit.com")
      expect(email_log.cc_user_ids).to match_array([staged1.id])
    end
  end

  context "when the post in the argument is the OP" do
    let(:post_id) { post.topic.posts.first.id }

    context "when the group has imap enabled" do
      before { group.update!(imap_enabled: true) }

      it "aborts and does not send a group SMTP email; the OP is the one that sent the email in the first place" do
        expect { job.execute(args) }.not_to(change { EmailLog.count })
        expect(ActionMailer::Base.deliveries.count).to eq(0)
      end
    end

    context "when the group does not have imap enabled" do
      before { group.update!(imap_enabled: false) }

      it "sends the email as expected" do
        job.execute(args)
        expect(ActionMailer::Base.deliveries.count).to eq(1)
      end
    end
  end

  context "when the post is deleted" do
    it "aborts and adds a skipped email log" do
      post.trash!
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(0)
      expect(
        SkippedEmailLog.exists?(
          email_type: "group_smtp",
          user: recipient_user,
          post: nil,
          to_address: recipient_user.email,
          reason_type: SkippedEmailLog.reason_types[:group_smtp_post_deleted],
        ),
      ).to eq(true)
    end
  end

  context "when the topic is deleted" do
    it "aborts and adds a skipped email log" do
      post.topic.trash!
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(0)
      expect(
        SkippedEmailLog.exists?(
          email_type: "group_smtp",
          user: recipient_user,
          post: post,
          to_address: recipient_user.email,
          reason_type: SkippedEmailLog.reason_types[:group_smtp_topic_deleted],
        ),
      ).to eq(true)
    end
  end

  context "when smtp is not enabled" do
    it "returns without sending email" do
      SiteSetting.enable_smtp = false
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(0)
    end
  end

  context "when disable_emails is yes" do
    it "returns without sending email" do
      SiteSetting.disable_emails = "yes"
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(0)
    end
  end

  context "when group is deleted" do
    it "returns without sending email" do
      group.destroy
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(0)
    end
  end

  context "when smtp is not enabled for the group" do
    it "returns without sending email" do
      group.update!(smtp_enabled: false)
      job.execute(args)
      expect(ActionMailer::Base.deliveries.count).to eq(0)
      expect(
        SkippedEmailLog.exists?(
          email_type: "group_smtp",
          user: recipient_user,
          post: post,
          to_address: recipient_user.email,
          reason_type: SkippedEmailLog.reason_types[:group_smtp_disabled_for_group],
        ),
      ).to eq(true)
    end
  end
end
