import type { Dataview, ViewInput, HostApp, Page } from "./host";
import type { Moment, MomentInput } from "moment";
declare const dv: Dataview;
declare const input: ViewInput | undefined;
declare const app: HostApp;
declare const moment: typeof import("moment");
declare const Notice: new (message: string) => unknown;
// Shared helpers for Compass widgets. Loaded by other views with dv.view? No: Dataview
// views cannot import each other, so each view re-declares what it needs. This file
// documents the conventions and is kept for reference only.
//
// Conventions:
//   - Daily notes are named YYYY-MM-DD and live in cfg.daily_folder.
//   - Daily questions are number properties named <dq_prefix><name>  (1..10).
//   - Habits are checkbox properties named <habit_prefix><name>.
//   - Wheel of life areas are number properties named <wheel_prefix><name> (1..10)
//     inside the note "<retreat_folder>/YYYY-QN 个人静修".
//   - moment() is available globally inside Obsidian.
