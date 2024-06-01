# frozen_string_literal: true

require_relative "bbcode/xml_to_markdown"

module ImportScripts::PhpBB3
  class TextProcessor
    # @param lookup [ImportScripts::LookupContainer]
    # @param database [ImportScripts::PhpBB3::Database_3_0 | ImportScripts::PhpBB3::Database_3_1]
    # @param smiley_processor [ImportScripts::PhpBB3::SmileyProcessor]
    # @param settings [ImportScripts::PhpBB3::Settings]
    # @param phpbb_config [Hash]
    def initialize(lookup, database, smiley_processor, settings, phpbb_config)
      @lookup = lookup
      @database = database
      @smiley_processor = smiley_processor
      @he = HTMLEntities.new
      @use_xml_to_markdown =
        phpbb_config[:phpbb_version].start_with?("3.2") ||
          phpbb_config[:phpbb_version].start_with?("3.3")

      @settings = settings
      @new_site_prefix = settings.new_site_prefix
      create_internal_link_regexps(settings.original_site_prefix)
    end

    def process_raw_text(raw, attachments = nil)
      if @use_xml_to_markdown
        unreferenced_attachments = attachments&.dup

        converter =
          BBCode::XmlToMarkdown.new(
            raw,
            username_from_user_id: lambda { |user_id| @lookup.find_username_by_import_id(user_id) },
            smilie_to_emoji: lambda { |smilie| @smiley_processor.emoji(smilie).dup },
            quoted_post_from_post_id:
              lambda do |post_id|
                post_metadata = @lookup.topic_lookup_from_imported_post_id(post_id)
                post_metadata[:username] ||= Post.joins(:user).where(id: post_id).pick(:username)
                post_metadata
              end,
            upload_md_from_file:
              (
                lambda do |filename, index|
                  unreferenced_attachments[index] = nil
                  attachments.fetch(index, filename).dup
                end if attachments
              ),
            url_replacement: nil,
            allow_inline_code: false,
          )

        text = converter.convert

        text.gsub!(@short_internal_link_regexp) { |link| replace_internal_link(link, $1, $2) }

        add_unreferenced_attachments(text, unreferenced_attachments)
      else
        text = raw.dup
        text = CGI.unescapeHTML(text)

        clean_bbcodes(text)
        text = bbcode_to_md(text) if @settings.use_bbcode_to_md
        process_smilies(text)
        process_links(text)
        process_lists(text)
        process_code(text)
        fix_markdown(text)
        process_attachments(text, attachments) if attachments.present?
        process_videos(text)
        text
      end
    end

    def process_post(raw, attachments)
      begin
        process_raw_text(raw, attachments)
      rescue StandardError
        raw
      end
    end

    def process_private_msg(raw, attachments)
      begin
        process_raw_text(raw, attachments)
      rescue StandardError
        raw
      end
    end

    protected

    def clean_bbcodes(text)
      # Many phpbb bbcode tags have a hash attached to them. Examples:
      #   [url=https&#58;//google&#46;com:1qh1i7ky]click here[/url:1qh1i7ky]
      #   [quote=&quot;cybereality&quot;:b0wtlzex]Some text.[/quote:b0wtlzex]
      text.gsub!(/:(?:\w{5,8})\]/, "]")

      # remove color tags
      text.gsub!(%r{\[/?color(=#?[a-z0-9]*)?\]}i, "")
    end

    def bbcode_to_md(text)
      begin
        text.bbcode_to_md(false)
      rescue => e
        puts "Problem converting \n#{text}\n using ruby-bbcode-to-md"
        text
      end
    end

    def process_smilies(text)
      @smiley_processor.replace_smilies(text)
    end

    def process_links(text)
      # Internal forum links can have this forms:
      # for topics: <!-- l --><a class="postlink-local" href="https://example.com/forums/viewtopic.php?f=26&amp;t=3412">viewtopic.php?f=26&amp;t=3412</a><!-- l -->
      # for posts: <!-- l --><a class="postlink-local" href="https://example.com/forums/viewtopic.php?p=1732#p1732">viewtopic.php?p=1732#p1732</a><!-- l -->
      text.gsub!(@long_internal_link_regexp) { |link| replace_internal_link(link, $1, $2) }

      # Some links look like this: <!-- m --><a class="postlink" href="http://www.onegameamonth.com">http://www.onegameamonth.com</a><!-- m -->
      text.gsub!(%r{<!-- \w --><a(?:.+)href="(\S+)"(?:.*)>(.+)</a><!-- \w -->}i, '[\2](\1)')

      # Replace internal forum links that aren't in the <!-- l --> format
      text.gsub!(@short_internal_link_regexp) { |link| replace_internal_link(link, $1, $2) }

      # phpBB shortens link text like this, which breaks our markdown processing:
      #   [http://answers.yahoo.com/question/index ... 223AAkkPli](http://answers.yahoo.com/question/index?qid=20070920134223AAkkPli)
      #
      # Work around it for now:
      text.gsub!(%r{\[http(s)?://(www\.)?}i, "[")
    end

    def replace_internal_link(link, import_topic_id, import_post_id)
      if import_post_id.nil?
        replace_internal_topic_link(link, import_topic_id)
      else
        replace_internal_post_link(link, import_post_id)
      end
    end

    def replace_internal_topic_link(link, import_topic_id)
      import_post_id = @database.get_first_post_id(import_topic_id)
      return link if import_post_id.nil?

      replace_internal_post_link(link, import_post_id)
    end

    def replace_internal_post_link(link, import_post_id)
      topic = @lookup.topic_lookup_from_imported_post_id(import_post_id)
      topic ? "#{@new_site_prefix}#{topic[:url]}" : link
    end

    def process_lists(text)
      # convert list tags to ul and list=1 tags to ol
      # list=a is not supported, so handle it like list=1
      # list=9 and list=x have the same result as list=1 and list=a
      text.gsub!(%r{\[list\](.*?)\[/list:u\]}mi) do
        $1.gsub(%r{\[\*\](.*?)\[/\*:m\]\n*}mi) { "* #{$1}\n" }
      end

      text.gsub!(%r{\[list=.*?\](.*?)\[/list:o\]}mi) do
        $1.gsub(%r{\[\*\](.*?)\[/\*:m\]\n*}mi) { "1. #{$1}\n" }
      end
    end

    # This replaces existing [attachment] BBCodes with the corresponding HTML tags for Discourse.
    # All attachments that haven't been referenced in the text are appended to the end of the text.
    def process_attachments(text, attachments)
      attachment_regexp =
        %r{\[attachment=([\d])+\]<!-- [\w]+ -->([^<]+)<!-- [\w]+ -->\[/attachment\]?}i
      unreferenced_attachments = attachments.dup

      text.gsub!(attachment_regexp) do
        index = $1.to_i
        real_filename = $2
        unreferenced_attachments[index] = nil
        attachments.fetch(index, real_filename)
      end

      add_unreferenced_attachments(text, unreferenced_attachments)
    end

    def add_unreferenced_attachments(text, unreferenced_attachments)
      return text unless unreferenced_attachments

      unreferenced_attachments = unreferenced_attachments.compact
      text << "\n" << unreferenced_attachments.join("\n") unless unreferenced_attachments.empty?
      text
    end

    def create_internal_link_regexps(original_site_prefix)
      host = original_site_prefix.gsub(".", '\.')
      link_regex =
        "http(?:s)?://#{host}/viewtopic\\.php\\?(?:\\S*)(?:t=(\\d+)|p=(\\d+)(?:#p\\d+)?)(?:[^\\s\\)\\]]*)"

      @long_internal_link_regexp =
        Regexp.new(
          %Q|<!-- l --><a(?:.+)href="#{link_regex}"(?:.*)</a><!-- l -->|,
          Regexp::IGNORECASE,
        )
      @short_internal_link_regexp = Regexp.new(link_regex, Regexp::IGNORECASE)
    end

    def process_code(text)
      text.gsub!(%r{<span class="syntax.*?>(.*?)</span>}) { "#{$1}" }
      text.gsub!(%r{\[code(=[a-z]*)?\](.*?)\[/code\]}i) { "[code]\n#{@he.decode($2)}\n[/code]" }
      text.gsub!(%r{<br />}, "\n")
      text
    end

    def fix_markdown(text)
      text.gsub!(%r{(\n*\[/?quote.*?\]\n*)}mi) { |q| "\n#{q.strip}\n" }
      text.gsub!(/^!\[[^\]]*\]\([^\]]*\)$/i) { |img| "\n#{img.strip}\n" } # space out images single on line
      text
    end

    def process_videos(text)
      # [YOUTUBE]<id>[/YOUTUBE]
      text.gsub(%r{\[youtube\](.+?)\[/youtube\]}i) { "\nhttps://www.youtube.com/watch?v=#{$1}\n" }
      text
    end
  end
end
