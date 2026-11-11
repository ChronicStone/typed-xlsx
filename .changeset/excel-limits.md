---
"typed-xlsx": patch
---

Workbooks that break an Excel limit now throw an error that names the cause, instead of writing a file Excel repairs or refuses: more than 1,048,576 rows or 16,384 columns, text over 32,767 characters, duplicate excel-table names or headers, duplicate column ids, and inline dropdown lists over 255 characters. Sheet names are now compared ignoring case, `History` is avoided, column widths stop at 255, and brackets in structured-reference headers are escaped the way Excel expects.
