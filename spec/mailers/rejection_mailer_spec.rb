# frozen_string_literal: true

RSpec.describe RejectionMailer do
  describe "send_rejection" do
    context "when sending rejection email" do
      fab!(:user)
      let(:template_args) do
        { former_title: "Mail Subject", destination: user.email, site_name: SiteSetting.title }
      end
      let(:reject_mail) do
        RejectionMailer.send_rejection("email_reject_topic_not_found", user.email, template_args)
      end

      it "renders the senders email" do
        expect(reject_mail.to).to eql([user.email])
      end

      it "renders the subject" do
        expect(reject_mail.subject).to be_present
      end

      it "renders site title in subject" do
        expect(reject_mail.subject).to match(SiteSetting.title)
      end

      it "renders the body" do
        expect(reject_mail.body).to be_present
      end
    end
  end
end
