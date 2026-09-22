import type { PlannedHyperlink } from "../planner/rows";
import type { TableStyleDefaults } from "../workbook/types";
import type { StylesCollector } from "./collector";
import { withTableDefaultBodyStyle, withTableDefaultHyperlinkBodyStyle } from "./defaults";
import type { CellStyle } from "./types";

export class TableBodyStyles {
  private readonly previousByColumn: Array<{ key: string; index: number }> = [];

  constructor(
    private readonly styles: StylesCollector,
    private readonly defaults?: TableStyleDefaults,
  ) {}

  resolve(columnIndex: number, cell: { style?: CellStyle; hyperlink?: PlannedHyperlink }) {
    const key = JSON.stringify([cell.style, cell.hyperlink ? [cell.hyperlink.style] : null]);
    const previous = this.previousByColumn[columnIndex];
    if (previous?.key === key) return previous.index;

    const style = cell.hyperlink
      ? withTableDefaultHyperlinkBodyStyle(this.defaults, cell.style, cell.hyperlink.style)
      : withTableDefaultBodyStyle(this.defaults, cell.style);
    const index = this.styles.addStyle(style);
    this.previousByColumn[columnIndex] = { key, index };
    return index;
  }
}
