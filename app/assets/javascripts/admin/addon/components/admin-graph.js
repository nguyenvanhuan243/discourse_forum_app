import Component from "@ember/component";
import { tagName } from "@ember-decorators/component";
import loadScript from "discourse/lib/load-script";

@tagName("canvas")
export default class AdminGraph extends Component {
  type = "line";

  refreshChart() {
    const ctx = this.element.getContext("2d");
    const model = this.model;
    const rawData = this.get("model.data");

    let data = {
      labels: rawData.map((r) => r.x),
      datasets: [
        {
          data: rawData.map((r) => r.y),
          label: model.get("title"),
          backgroundColor: `rgba(200,220,240,${this.type === "bar" ? 1 : 0.3})`,
          borderColor: "#08C",
        },
      ],
    };

    const config = {
      type: this.type,
      data,
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              title: (context) =>
                moment(context[0].label, "YYYY-MM-DD").format("LL"),
            },
          },
        },
        scales: {
          y: [
            {
              display: true,
              ticks: {
                stepSize: 1,
              },
            },
          ],
        },
      },
    };

    this._chart = new window.Chart(ctx, config);
  }

  didInsertElement() {
    super.didInsertElement(...arguments);
    loadScript("/javascripts/Chart.min.js").then(() =>
      this.refreshChart.apply(this)
    );
  }
}
