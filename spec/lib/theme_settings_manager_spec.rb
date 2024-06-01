# frozen_string_literal: true

RSpec.describe ThemeSettingsManager do
  let!(:theme) { Fabricate(:theme) }

  let(:theme_settings) do
    yaml = File.read("#{Rails.root}/spec/fixtures/theme_settings/valid_settings.yaml")
    theme.set_field(target: :settings, name: "yaml", value: yaml)
    theme.save!
    theme.settings
  end

  describe "Enum" do
    it "only accepts values from its choices" do
      enum_setting = theme_settings[:enum_setting]
      expect { enum_setting.value = "trust level 2" }.to raise_error(Discourse::InvalidParameters)
      expect { enum_setting.value = "trust level 0" }.not_to raise_error

      enum_setting = theme_settings[:enum_setting_02]
      expect { enum_setting.value = "10" }.not_to raise_error

      enum_setting = theme_settings[:enum_setting_03]
      expect { enum_setting.value = "10" }.not_to raise_error
      expect { enum_setting.value = 1 }.not_to raise_error
      expect { enum_setting.value = 15 }.to raise_error(Discourse::InvalidParameters)
    end
  end

  describe "Bool" do
    it "is either true or false" do
      bool_setting = theme_settings[:boolean_setting]
      expect(bool_setting.value).to eq(true) # default

      bool_setting.value = "true"
      theme.reload
      expect(bool_setting.value).to eq(true)

      bool_setting.value = "falsse" # intentionally misspelled
      theme.reload
      expect(bool_setting.value).to eq(false)

      bool_setting.value = true
      theme.reload
      expect(bool_setting.value).to eq(true)
    end
  end

  describe "Integer" do
    it "is always an integer" do
      int_setting = theme_settings[:integer_setting]
      int_setting.value = 1.6
      theme.reload
      expect(int_setting.value).to eq(1)

      int_setting.value = "4.3"
      theme.reload
      expect(int_setting.value).to eq(4)

      int_setting.value = "10"
      theme.reload
      expect(int_setting.value).to eq(10)

      int_setting.value = "text"
      theme.reload
      expect(int_setting.value).to eq(0)
    end

    it "can have min or max value" do
      int_setting = theme_settings[:integer_setting_02]
      expect { int_setting.value = 0 }.to raise_error(Discourse::InvalidParameters)
      expect { int_setting.value = 61 }.to raise_error(Discourse::InvalidParameters)

      int_setting.value = 60
      theme.reload
      expect(int_setting.value).to eq(60)

      int_setting.value = 1
      theme.reload
      expect(int_setting.value).to eq(1)
    end
  end

  describe "Float" do
    it "is always a float" do
      float_setting = theme_settings[:float_setting]
      float_setting.value = 1.615
      theme.reload
      expect(float_setting.value).to eq(1.615)

      float_setting.value = "3.1415"
      theme.reload
      expect(float_setting.value).to eq(3.1415)

      float_setting.value = 10
      theme.reload
      expect(float_setting.value).to eq(10)
    end

    it "can have min or max value" do
      float_setting = theme_settings[:float_setting]
      expect { float_setting.value = 1.4 }.to raise_error(Discourse::InvalidParameters)
      expect { float_setting.value = 10.01 }.to raise_error(Discourse::InvalidParameters)
      expect { float_setting.value = "text" }.to raise_error(Discourse::InvalidParameters)

      float_setting.value = 9.521
      theme.reload
      expect(float_setting.value).to eq(9.521)
    end
  end

  describe "String" do
    it "can have min or max length" do
      string_setting = theme_settings[:string_setting_02]
      expect { string_setting.value = "a" }.to raise_error(Discourse::InvalidParameters)

      string_setting.value = "ab"
      theme.reload
      expect(string_setting.value).to eq("ab")

      string_setting.value = "ab" * 10
      theme.reload
      expect(string_setting.value).to eq("ab" * 10)

      expect { string_setting.value = ("a" * 21) }.to raise_error(Discourse::InvalidParameters)
    end

    it "can be a textarea" do
      expect(theme_settings[:string_setting_02].textarea).to eq(false)
      expect(theme_settings[:string_setting_03].textarea).to eq(true)
    end

    it "supports json schema" do
      expect(theme_settings[:string_setting_03].json_schema).to eq(false)
      expect(theme_settings[:invalid_json_schema_setting].json_schema).to eq(false)
      expect(theme_settings[:valid_json_schema_setting].json_schema).to be_truthy
    end
  end

  describe "List" do
    it "can have a list type" do
      list_setting = theme_settings[:compact_list_setting]
      expect(list_setting.list_type).to eq("compact")
    end
  end

  describe "Upload" do
    let!(:upload) { Fabricate(:upload) }

    it "saves the upload id" do
      upload_setting = theme_settings[:upload_setting]
      upload_setting.value = upload.url
      theme.reload

      expect(
        ThemeSetting.exists?(theme_id: theme.id, name: "upload_setting", value: upload.id.to_s),
      ).to be_truthy
    end

    describe "#value" do
      context "when it's changed to a custom upload" do
        it "returns CDN URL" do
          upload_setting = theme_settings[:upload_setting]
          upload_setting.value = upload.url
          theme.reload

          expect(upload_setting.value).to eq(Discourse.store.cdn_url(upload.url))
        end
      end

      context "when there's a default upload" do
        it "returns CDN URL" do
          theme.set_field(
            target: :common,
            name: "default-upload",
            type: :theme_upload_var,
            upload_id: upload.id,
          )
          theme.save!
          upload_setting = theme_settings[:upload_setting]
          expect(upload_setting.value).to eq(Discourse.store.cdn_url(upload.url))
        end
      end
    end
  end
end
