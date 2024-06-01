# frozen_string_literal: true

RSpec.describe Jobs::CorrectMissingDualstackUrls do
  it "corrects the urls" do
    setup_s3
    SiteSetting.s3_region = "us-east-1"
    SiteSetting.s3_upload_bucket = "custom-bucket"

    # we will only correct for our base_url, random urls will be left alone
    expect(Discourse.store.absolute_base_url).to eq(
      "//custom-bucket.s3.dualstack.us-east-1.amazonaws.com",
    )

    current_upload =
      Upload.create!(
        url: "//custom-bucket.s3-us-east-1.amazonaws.com/somewhere/a.png",
        original_filename: "a.png",
        filesize: 100,
        user_id: Discourse::SYSTEM_USER_ID,
      )

    bad_upload =
      Upload.create!(
        url: "//custom-bucket.s3-us-west-1.amazonaws.com/somewhere/a.png",
        original_filename: "a.png",
        filesize: 100,
        user_id: Discourse::SYSTEM_USER_ID,
      )

    current_optimized =
      OptimizedImage.create!(
        url: "//custom-bucket.s3-us-east-1.amazonaws.com/somewhere/a.png",
        filesize: 100,
        upload_id: current_upload.id,
        width: 100,
        height: 100,
        sha1: "xxx",
        extension: ".png",
      )

    bad_optimized =
      OptimizedImage.create!(
        url: "//custom-bucket.s3-us-west-1.amazonaws.com/somewhere/a.png",
        filesize: 100,
        upload_id: current_upload.id,
        width: 110,
        height: 100,
        sha1: "xxx",
        extension: ".png",
      )

    Jobs::CorrectMissingDualstackUrls.new.execute_onceoff(nil)

    bad_upload.reload
    expect(bad_upload.url).to eq("//custom-bucket.s3-us-west-1.amazonaws.com/somewhere/a.png")

    current_upload.reload
    expect(current_upload.url).to eq(
      "//custom-bucket.s3.dualstack.us-east-1.amazonaws.com/somewhere/a.png",
    )

    bad_optimized.reload
    expect(bad_optimized.url).to eq("//custom-bucket.s3-us-west-1.amazonaws.com/somewhere/a.png")

    current_optimized.reload
    expect(current_optimized.url).to eq(
      "//custom-bucket.s3.dualstack.us-east-1.amazonaws.com/somewhere/a.png",
    )
  end
end
