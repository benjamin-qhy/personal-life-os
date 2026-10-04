import type { Dataview, Page } from "../views/host";
declare const dv: Dataview;
await dv.view("Meta/views/dailyquestions", { days: 90 });
