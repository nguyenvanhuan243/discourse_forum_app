# frozen_string_literal: true

require "sanitize"

class Search
  class GroupedSearchResults
    include ActiveModel::Serialization

    class TextHelper
      extend ActionView::Helpers::TextHelper
    end

    attr_reader(
      :type_filter,
      :posts,
      :categories,
      :extra_categories,
      :users,
      :tags,
      :groups,
      :more_posts,
      :more_categories,
      :more_users,
      :term,
      :search_context,
      :more_full_page_results,
      :error,
      :use_pg_headlines_for_excerpt,
      :can_lazy_load_categories,
    )

    attr_accessor :search_log_id

    BLURB_LENGTH = 200

    def initialize(
      type_filter:,
      term:,
      search_context:,
      blurb_length: nil,
      blurb_term: nil,
      is_header_search: false,
      use_pg_headlines_for_excerpt: SiteSetting.use_pg_headlines_for_excerpt,
      can_lazy_load_categories: false
    )
      @type_filter = type_filter
      @term = term
      @blurb_term = blurb_term || term
      @search_context = search_context
      @blurb_length = blurb_length || BLURB_LENGTH
      @posts = []
      @categories = []
      @extra_categories = Set.new
      @users = []
      @tags = []
      @groups = []
      @error = nil
      @is_header_search = is_header_search
      @use_pg_headlines_for_excerpt = use_pg_headlines_for_excerpt
      @can_lazy_load_categories = can_lazy_load_categories
    end

    def error=(error)
      @error = error
    end

    def find_user_data(guardian)
      if user = guardian.user
        topics = @posts.map(&:topic)
        topic_lookup = TopicUser.lookup_for(user, topics)
        topics.each { |ft| ft.user_data = topic_lookup[ft.id] }
      end
    end

    OMISSION = "..."
    SCRUB_HEADLINE_REGEXP =
      %r{<span(?: \w+="[^"]+")* class="#{Search::HIGHLIGHT_CSS_CLASS}"(?: \w+="[^"]+")*>([^<]*)</span>}

    def blurb(post)
      opts = { term: @blurb_term, blurb_length: @blurb_length }
      post_search_data_version = post&.post_search_data&.version

      if post_search_data_version.present? &&
           post_search_data_version >= SearchIndexer::MIN_POST_BLURB_INDEX_VERSION &&
           !Search.segment_chinese? && !Search.segment_japanese?
        if use_pg_headlines_for_excerpt
          scrubbed_headline = post.headline.gsub(SCRUB_HEADLINE_REGEXP, '\1')
          prefix_omission = scrubbed_headline.start_with?(post.leading_raw_data) ? "" : OMISSION
          postfix_omission = scrubbed_headline.end_with?(post.trailing_raw_data) ? "" : OMISSION
          return "#{prefix_omission}#{post.headline}#{postfix_omission}"
        else
          opts[:cooked] = post.post_search_data.raw_data
          opts[:scrub] = false
        end
      else
        opts[:cooked] = post.cooked
      end

      GroupedSearchResults.blurb_for(**opts)
    end

    def add(object)
      type = object.class.to_s.downcase.pluralize
      if !@is_header_search && public_send(type).length == Search.per_filter
        @more_full_page_results = true
      elsif @is_header_search && public_send(type).length == Search.per_facet
        instance_variable_set("@more_#{type}".to_sym, true)
      else
        (self.public_send(type)) << object
      end

      if can_lazy_load_categories
        category =
          case type
          when "posts"
            object.topic.category
          when "topics"
            object.category
          end

        if category
          extra_categories << category.parent_category if category.parent_category
          extra_categories << category
        end
      end
    end

    def self.blurb_for(cooked: nil, term: nil, blurb_length: BLURB_LENGTH, scrub: true)
      blurb = nil

      if scrub
        cooked = SearchIndexer::HtmlScrubber.scrub(cooked)

        urls = Set.new
        cooked.scan(Discourse::Utils::URI_REGEXP) { urls << $& }
        urls.each do |url|
          begin
            case File.extname(URI(url).path || "")
            when Oneboxer::VIDEO_REGEX
              cooked.gsub!(url, I18n.t("search.video"))
            when Oneboxer::AUDIO_REGEX
              cooked.gsub!(url, I18n.t("search.audio"))
            end
          rescue URI::InvalidURIError
          end
        end
      end

      if term
        term = Regexp.last_match[1] if term =~ Regexp.new(Search::PHRASE_MATCH_REGEXP_PATTERN)

        blurb = TextHelper.excerpt(cooked, term, radius: blurb_length / 2)
      end

      blurb = TextHelper.truncate(cooked, length: blurb_length) if blurb.blank?
      Sanitize.clean(blurb)
    end
  end
end
