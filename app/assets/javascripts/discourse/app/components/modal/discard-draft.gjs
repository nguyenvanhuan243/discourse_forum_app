import Component from "@glimmer/component";
import { action } from "@ember/object";
import DButton from "discourse/components/d-button";
import DModal from "discourse/components/d-modal";
import i18n from "discourse-common/helpers/i18n";

export default class DiscardDraftModal extends Component {
  @action
  async discardDraft() {
    await this.args.model.onDestroyDraft();
    this.args.closeModal();
  }

  @action
  async saveDraftAndClose() {
    await this.args.model.onSaveDraft();
    this.args.closeModal();
  }

  <template>
    <DModal
      @closeModal={{@closeModal}}
      class="discard-draft-modal"
      @dismissable={{false}}
    >
      <:body>
        <div class="instructions">
          {{i18n "post.cancel_composer.confirm"}}
        </div>
      </:body>

      <:footer>
        <DButton
          @icon="far-trash-alt"
          @label="post.cancel_composer.discard"
          @action={{this.discardDraft}}
          class="btn-danger discard-draft"
        />
        {{#if @model.showSaveDraftButton}}
          <DButton
            @label="post.cancel_composer.save_draft"
            @action={{this.saveDraftAndClose}}
            class="save-draft"
          />
        {{/if}}
        <DButton
          @label="post.cancel_composer.keep_editing"
          @action={{@closeModal}}
          class="keep-editing"
        />
      </:footer>
    </DModal>
  </template>
}
