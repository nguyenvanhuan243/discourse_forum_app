import Component from "@glimmer/component";
import { service } from "@ember/service";

export default class ComposerContainer extends Component {
  @service composer;
  @service site;
}
