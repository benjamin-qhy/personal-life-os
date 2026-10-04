import type { Dataview, Page } from "../views/host";
declare const dv: Dataview;
await dv.view("系统/views/dailyquestions", { days: 90 });
