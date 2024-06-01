# frozen_string_literal: true

RSpec.describe Onebox::Engine::MotokoOnebox do
  before do
    body =
      '{"version":"1.0","provider_name":"Embed Motoko","provider_url":"https://embed.motoko.org","type":"rich","width":800,"height":500,"html":"<iframe src=\"https://embed.motoko.org\" width=\"800\" height=\"500\" style=\"border:0\" />"}'

    stub_request(
      :get,
      "https://embed.smartcontracts.org/services/onebox?url=https://embed.motoko.org",
    ).to_return(status: 200, body: body, headers: {})
  end

  it "returns the expected iframe markup" do
    expect(Onebox.preview("https://embed.motoko.org").to_s.chomp).to include(
      '<iframe src="https://embed.motoko.org" width="800" height="500" style="border:0"',
    )
  end
end
