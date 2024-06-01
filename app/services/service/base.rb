# frozen_string_literal: true

module Service
  module Base
    extend ActiveSupport::Concern

    # The only exception that can be raised by a service.
    class Failure < StandardError
      # @return [Context]
      attr_reader :context

      # @!visibility private
      def initialize(context = nil)
        @context = context
        super
      end
    end

    # Simple structure to hold the context of the service during its whole lifecycle.
    class Context < OpenStruct
      include ActiveModel::Serialization

      # @return [Boolean] returns +true+ if the context is set as successful (default)
      def success?
        !failure?
      end

      # @return [Boolean] returns +true+ if the context is set as failed
      # @see #fail!
      # @see #fail
      def failure?
        @failure || false
      end

      # Marks the context as failed.
      # @param context [Hash, Context] the context to merge into the current one
      # @example
      #   context.fail!("failure": "something went wrong")
      # @return [Context]
      def fail!(context = {})
        self.fail(context)
        raise Failure, self
      end

      # Marks the context as failed without raising an exception.
      # @param context [Hash, Context] the context to merge into the current one
      # @example
      #   context.fail("failure": "something went wrong")
      # @return [Context]
      def fail(context = {})
        merge(context)
        @failure = true
        self
      end

      # Merges the given context into the current one.
      # @!visibility private
      def merge(other_context = {})
        other_context.each { |key, value| self[key.to_sym] = value }
        self
      end

      def inspect_steps
        StepsInspector.new(self)
      end

      private

      def self.build(context = {})
        self === context ? context : new(context)
      end
    end

    # Internal module to define available steps as DSL
    # @!visibility private
    module StepsHelpers
      def model(name = :model, step_name = :"fetch_#{name}", optional: false)
        steps << ModelStep.new(name, step_name, optional: optional)
      end

      def contract(name = :default, class_name: self::Contract, default_values_from: nil)
        steps << ContractStep.new(
          name,
          class_name: class_name,
          default_values_from: default_values_from,
        )
      end

      def policy(name = :default, class_name: nil)
        steps << PolicyStep.new(name, class_name: class_name)
      end

      def step(name)
        steps << Step.new(name)
      end

      def transaction(&block)
        steps << TransactionStep.new(&block)
      end
    end

    # @!visibility private
    class Step
      attr_reader :name, :method_name, :class_name

      def initialize(name, method_name = name, class_name: nil)
        @name = name
        @method_name = method_name
        @class_name = class_name
      end

      def call(instance, context)
        object = class_name&.new(context)
        method = object&.method(:call) || instance.method(method_name)
        args = context.to_h.slice(*method.parameters.select { _1[0] == :keyreq }.map(&:last))
        context[result_key] = Context.build(object: object)
        instance.instance_exec(**args, &method)
      end

      private

      def type
        self.class.name.split("::").last.downcase.sub(/^(\w+)step$/, "\\1")
      end

      def result_key
        "result.#{type}.#{name}"
      end
    end

    # @!visibility private
    class ModelStep < Step
      attr_reader :optional

      def initialize(name, method_name = name, class_name: nil, optional: nil)
        super(name, method_name, class_name: class_name)
        @optional = optional.present?
      end

      def call(instance, context)
        context[name] = super
        raise ArgumentError, "Model not found" if !optional && context[name].blank?
        if context[name].try(:invalid?)
          context[result_key].fail(invalid: true)
          context.fail!
        end
      rescue ArgumentError => exception
        context[result_key].fail(exception: exception)
        context.fail!
      end
    end

    # @!visibility private
    class PolicyStep < Step
      def call(instance, context)
        if !super
          context[result_key].fail(reason: context[result_key].object&.reason)
          context.fail!
        end
      end
    end

    # @!visibility private
    class ContractStep < Step
      attr_reader :default_values_from

      def initialize(name, method_name = name, class_name: nil, default_values_from: nil)
        super(name, method_name, class_name: class_name)
        @default_values_from = default_values_from
      end

      def call(instance, context)
        attributes = class_name.attribute_names.map(&:to_sym)
        default_values = {}
        default_values = context[default_values_from].slice(*attributes) if default_values_from
        contract = class_name.new(default_values.merge(context.to_h.slice(*attributes)))
        context[contract_name] = contract
        context[result_key] = Context.build
        if contract.invalid?
          context[result_key].fail(errors: contract.errors)
          context.fail!
        end
      end

      private

      def contract_name
        return :contract if name.to_sym == :default
        :"#{name}_contract"
      end
    end

    # @!visibility private
    class TransactionStep < Step
      include StepsHelpers

      attr_reader :steps

      def initialize(&block)
        @steps = []
        instance_exec(&block)
      end

      def call(instance, context)
        ActiveRecord::Base.transaction { steps.each { |step| step.call(instance, context) } }
      end
    end

    included do
      # The global context which is available from any step.
      attr_reader :context

      # @!visibility private
      # Internal class used to setup the base contract of the service.
      self::Contract =
        Class.new do
          include ActiveModel::API
          include ActiveModel::Attributes
          include ActiveModel::AttributeMethods
          include ActiveModel::Validations::Callbacks
        end
    end

    class_methods do
      include StepsHelpers

      def call(context = {})
        new(context).tap(&:run).context
      end

      def call!(context = {})
        new(context).tap(&:run!).context
      end

      def steps
        @steps ||= []
      end
    end

    # @!scope class
    # @!method model(name = :model, step_name = :"fetch_#{name}", optional: false)
    # @param name [Symbol] name of the model
    # @param step_name [Symbol] name of the method to call for this step
    # @param optional [Boolean] if +true+, then the step won’t fail if its return value is falsy.
    # Evaluates arbitrary code to build or fetch a model (typically from the
    # DB). If the step returns a falsy value, then the step will fail.
    #
    # It stores the resulting model in +context[:model]+ by default (can be
    # customized by providing the +name+ argument).
    #
    # @example
    #   model :channel, :fetch_channel
    #
    #   private
    #
    #   def fetch_channel(channel_id:)
    #     Chat::Channel.find_by(id: channel_id)
    #   end

    # @!scope class
    # @!method policy(name = :default, class_name: nil)
    # @param name [Symbol] name for this policy
    # @param class_name [Class] a policy object (should inherit from +PolicyBase+)
    # Performs checks related to the state of the system. If the
    # step doesn’t return a truthy value, then the policy will fail.
    #
    # When using a policy object, there is no need to define a method on the
    # service for the policy step. The policy object `#call` method will be
    # called and if the result isn’t truthy, a `#reason` method is expected to
    # be implemented to explain the failure.
    #
    # Policy objects are usually useful for more complex logic.
    #
    # @example Without a policy object
    #   policy :no_direct_message_channel
    #
    #   private
    #
    #   def no_direct_message_channel(channel:)
    #     !channel.direct_message_channel?
    #   end
    #
    # @example With a policy object
    #   # in the service object
    #   policy :no_direct_message_channel, class_name: NoDirectMessageChannelPolicy
    #
    #   # in the policy object File
    #   class NoDirectMessageChannelPolicy < PolicyBase
    #     def call
    #       !context.channel.direct_message_channel?
    #     end
    #
    #     def reason
    #       "Direct message channels aren’t supported"
    #     end
    #   end

    # @!scope class
    # @!method contract(name = :default, class_name: self::Contract, default_values_from: nil)
    # @param name [Symbol] name for this contract
    # @param class_name [Class] a class defining the contract
    # @param default_values_from [Symbol] name of the model to get default values from
    # Checks the validity of the input parameters.
    # Implements ActiveModel::Validations and ActiveModel::Attributes.
    #
    # It stores the resulting contract in +context[:contract]+ by default
    # (can be customized by providing the +name+ argument).
    #
    # @example
    #   contract
    #
    #   class Contract
    #     attribute :name
    #     validates :name, presence: true
    #   end

    # @!scope class
    # @!method step(name)
    # @param name [Symbol] the name of this step
    # Runs arbitrary code. To mark a step as failed, a call to {#fail!} needs
    # to be made explicitly.
    #
    # @example
    #   step :update_channel
    #
    #   private
    #
    #   def update_channel(channel:, params_to_edit:)
    #     channel.update!(params_to_edit)
    #   end
    # @example using {#fail!} in a step
    #   step :save_channel
    #
    #   private
    #
    #   def save_channel(channel:)
    #     fail!("something went wrong") if !channel.save
    #   end

    # @!scope class
    # @!method transaction(&block)
    # @param block [Proc] a block containing steps to be run inside a transaction
    # Runs steps inside a DB transaction.
    #
    # @example
    #   transaction do
    #     step :prevents_slug_collision
    #     step :soft_delete_channel
    #     step :log_channel_deletion
    #   end

    # @!visibility private
    def initialize(initial_context = {})
      @initial_context = initial_context.with_indifferent_access
      @context = Context.build(initial_context.merge(__steps__: self.class.steps))
    end

    # @!visibility private
    def run
      run!
    rescue Failure => exception
      raise if context.object_id != exception.context.object_id
    end

    # @!visibility private
    def run!
      self.class.steps.each { |step| step.call(self, context) }
    end

    # @!visibility private
    def fail!(message)
      step_name = caller_locations(1, 1)[0].base_label
      context["result.step.#{step_name}"].fail(error: message)
      context.fail!
    end
  end
end
