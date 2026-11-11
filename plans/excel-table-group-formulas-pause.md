# Excel-Table Group Formulas: Pause Note

Temporary internal reminder.

## Status

Grouped formula scope is implemented at the public API/type level, including:

- flat `group(...)` support in `excel-table` schemas
- outer-scope formula refs from inside groups
- `row.group("groupId")` aggregations

However, native Excel table serialization for grouped formula columns is still not accepted by Excel in the kitchen-sink workbook.

Observed symptom:

- Excel repairs `sheet7.xml`
- Excel repairs `table2.xml`
- calculated columns are removed from the grouped native-table example

## Update: the two formula forms now match

The table part's `calculatedColumnFormula` and the cell `<f>` used to differ for grouped scope aggregates: the table part wrote `SUM(T[[#This Row],[B]:[C]])` and the cells wrote `SUM(T[[#This Row],[B]],T[[#This Row],[C]])`. Both now come from the same serializer and use the second form, in the buffered and the stream builder (`packages/core/test/builder-parity.test.ts` checks this).

This is not confirmed as the cause of the repair. **Open the kitchen-sink workbook in real Excel and check whether it still repairs `sheet7.xml` and `table2.xml` before closing this note.** If it does, continue with the checklist below.

## Current hypothesis

The remaining gap is not the public schema/formula API. It is the exact OOXML representation Excel expects for native table calculated-column formulas when grouped/generated columns and grouped aggregations are involved.

We should resume from a real Excel-authored fixture once Excel save is available.

## Resume checklist

1. Create a tiny native Excel table manually in Excel
2. Add grouped-style calculated columns through the Excel UI
3. Save the workbook
4. Diff Excel-authored:
   - `xl/worksheets/sheet*.xml`
   - `xl/tables/table*.xml`
5. Align native table serialization with the real fixture

## Documentation implication

Do not overstate this capability in public docs until the native Excel table workbook opens cleanly without repair.
