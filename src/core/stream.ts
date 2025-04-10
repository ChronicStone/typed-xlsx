/* eslint-disable ts/ban-types */
import type { Writable } from 'node:stream'
import type { Style, Worksheet } from 'exceljs'
import { stream } from 'exceljs'
import type {
  AutoFormatOptions,
  BaseCellValue,
  CellValue,
  Column,
  ExcelSchema,
  ExtractContextMap,
  ExtractSelectedColumns,
  ExtractSelectedContext,
  FormatterPreset,
  GenericObject,
  Not,
  Prettify,
  SchemaColumnKeys,
  SchemaData,
} from '../types'

import {
  autoFormatColumns,
  calculateColumnWidth,
  createStreamCell,
  formatKey,
  getColumnHeaderStyle,
  getPropertyFromPath,
} from '../utils'

// Discriminated union for constructor options
type StreamBuilderOptions =
  | { filePath: string, stream?: never, chunkMaxSize?: number, useStyles?: boolean, useSharedStrings?: boolean, zip?: any, bordered?: boolean }
  | { filePath?: never, stream: Writable, chunkMaxSize?: number, useStyles?: boolean, useSharedStrings?: boolean, zip?: any, bordered?: boolean }

/**
 * Determines if a column is selected based on the selection criteria
 */
function isColumnSelected(columnKey: string, selectMap?: Record<string, boolean>): boolean {
  // If no selection map is provided, all columns are included
  if (!selectMap || Object.keys(selectMap).length === 0)
    return true

  // Check if we're in "inclusion mode" (at least one true value)
  const hasInclusionRules = Object.values(selectMap).includes(true)

  if (hasInclusionRules) {
    // In inclusion mode: column must be explicitly selected
    return selectMap[columnKey] === true
  }
  else {
    // In exclusion mode: column must not be explicitly excluded
    return selectMap[columnKey] !== false
  }
}

/**
 * Manages a streaming Excel worksheet
 */
export class StreamSheetBuilder<
  T extends GenericObject,
  Schema extends ExcelSchema<T, any, string>,
  Builder extends ExcelStreamBuilder<any>,
> {
  private worksheet: Worksheet
  private workbookWriter: stream.xlsx.WorkbookWriter
  private rowIndex: number = 1 // ExcelJS rows are 1-based
  private schema: Schema
  private isCommitted: boolean = false
  private parentBuilder: Builder
  private title?: string
  private titleStyle?: Partial<Style> | ((data: T[]) => Partial<Style>)
  private headerWritten: boolean = false
  private chunkMaxSize: number
  private firstRow: number = 1 // First data row (after title and header)

  private bordered: boolean
  private selectMap?: Record<string, boolean>

  // Auto-formatting properties
  private columnWidths: number[] = []
  private columnConstraints: Record<number, { minWidth?: number, maxWidth?: number, width?: number }> = {}
  private autoFormatOptions: AutoFormatOptions = {
    minWidth: 6,
    maxWidth: 50,
    headerWidthFactor: 1.2,
    disabled: false,
  }

  constructor(
    parentBuilder: Builder,
    workbookWriter: stream.xlsx.WorkbookWriter,
    worksheet: Worksheet,
    options: {
      schema: Schema
      title?: string
      titleStyle?: Partial<Style> | ((data: T[]) => Partial<Style>)
      chunkMaxSize: number
      bordered: boolean
      autoFormat?: AutoFormatOptions
      select?: Record<string, boolean>
    },
  ) {
    this.parentBuilder = parentBuilder
    this.workbookWriter = workbookWriter
    this.worksheet = worksheet
    this.schema = options.schema
    this.title = options.title
    this.titleStyle = options.titleStyle
    this.chunkMaxSize = options.chunkMaxSize
    this.bordered = options.bordered
    this.selectMap = options.select

    // Initialize auto-format options with defaults
    if (options.autoFormat) {
      this.autoFormatOptions = {
        ...this.autoFormatOptions,
        ...options.autoFormat,
      }
    }

    // Initialize column widths array and extract column constraints
    const flatColumns = this.flattenColumns(this.schema.columns)
    const columnCount = flatColumns.length
    this.columnWidths = Array(columnCount).fill(this.autoFormatOptions.minWidth || 6)

    // Extract column-specific constraints
    flatColumns.forEach((column, index) => {
      if (column.width !== undefined || column.minWidth !== undefined || column.maxWidth !== undefined) {
        this.columnConstraints[index] = {
          width: column.width,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        }

        // If a column has a fixed width, set it immediately
        if (column.width !== undefined)
          this.worksheet.getColumn(index + 1).width = column.width
      }
    })
  }

  /**
   * Process a chunk of data and write it to the Excel stream
   */
  public async addChunk(data: T[]): Promise<void> {
    if (this.isCommitted)
      throw new Error('Cannot add data to a committed sheet')

    if (!data || data.length === 0)
      return

    // Write header row if not already written
    if (!this.headerWritten)
      await this.writeHeaderRow()

    // Split data into sub-chunks if it exceeds the max chunk size
    const subChunks: T[][] = []
    for (let i = 0; i < data.length; i += this.chunkMaxSize)
      subChunks.push(data.slice(i, i + this.chunkMaxSize))

    for (const chunk of subChunks)
      await this.processChunk(chunk)
  }

  /**
   * Flatten schema columns, respecting column selection
   */
  private flattenColumns(columns: Schema['columns']): Column<any, any, any, any, any>[] {
    return columns.reduce((acc: Column<any, any, any, any, any>[], column) => {
      // Check if this column/group is selected before processing
      if (!isColumnSelected(column.columnKey, this.selectMap))
        return acc

      if (column.type === 'column') {
        acc.push(column as Column<any, any, any, any, any>)
      }
      else if (column.type === 'group') {
        // Only execute the handler if the group is selected
        const builder = column.builder()
        try {
          column.handler(builder, this.parentBuilder.getContext()[column.columnKey] || [])
          const { columns: groupColumns } = builder.build()
          acc.push(...this.flattenColumns(groupColumns as any))
        }
        catch (error) {
          console.warn(`Error processing group ${column.columnKey}:`, error)
        }
      }
      return acc
    }, [])
  }

  /**
   * Calculate estimated text width for auto-formatting
   */
  private calculateTextWidth(value: any): number {
    return calculateColumnWidth(value)
  }

  /**
   * Write header row with titles for each column
   */
  private async writeHeaderRow(): Promise<void> {
    // Write title if specified
    if (this.title) {
      const titleRow = this.worksheet.addRow([this.title])

      const customTitleStyle = typeof this.titleStyle === 'function'
        ? this.titleStyle([])
        : this.titleStyle ?? {}

      // Apply title styling using the adapted createStreamCell function
      createStreamCell({
        row: titleRow,
        colIndex: 1,
        value: this.title,
        style: {
          font: { bold: true, size: 14 },
          alignment: { horizontal: 'left', vertical: 'middle' },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFB4C4DE' }, // Light steel blue like in the regular builder
          },
          ...customTitleStyle,
        },
        bordered: this.bordered,
      })

      // Merge cells for title across all columns
      const flatColumns = this.flattenColumns(this.schema.columns)
      const columnsCount = flatColumns.length
      if (columnsCount > 1) {
        // The title row is the only place where we can safely use mergeCells in streaming mode
        // because we haven't committed the row yet
        this.worksheet.mergeCells(1, 1, 1, columnsCount)
      }

      // Set title row height
      titleRow.height = 30

      // Commit the title row
      await titleRow.commit()
      this.rowIndex++
    }

    // Process column headers
    const flatColumns = this.flattenColumns(this.schema.columns)
    const headerValues = flatColumns.map(column => column.label ?? formatKey(column.columnKey))
    const headerRow = this.worksheet.addRow(headerValues)

    // Apply styles to header cells and calculate header width if auto-formatting is enabled
    flatColumns.forEach((column, index) => {
      const headerStyle = getColumnHeaderStyle({
        bordered: this.bordered,
        customStyle: column.headerStyle,
      })

      createStreamCell({
        row: headerRow,
        colIndex: index + 1,
        value: headerValues[index],
        style: headerStyle,
        bordered: this.bordered,
      })

      // Calculate header width if auto-formatting is not disabled and column doesn't have fixed width
      if (!this.autoFormatOptions.disabled && this.columnConstraints[index]?.width === undefined) {
        const headerWidth = this.calculateTextWidth(headerValues[index]) * (this.autoFormatOptions.headerWidthFactor || 1.2)
        this.columnWidths[index] = Math.max(this.columnWidths[index], headerWidth)
      }
    })

    // Commit the header row
    await headerRow.commit()
    this.rowIndex++
    this.firstRow = this.rowIndex
    this.headerWritten = true
  }

  /**
   * Process a single chunk of data using visual styling to simulate merged cells
   */
  private async processChunk(chunk: T[]): Promise<void> {
    if (chunk.length === 0)
      return

    // Get filtered columns
    const flatColumns = this.flattenColumns(this.schema.columns)
    const chunkColsWidth = flatColumns.map(() => 0)

    // Process each row in the chunk
    for (let rowIdx = 0; rowIdx < chunk.length; rowIdx++) {
      const rowData = chunk[rowIdx]

      // First, analyze the row to determine if we have array values and the max array length
      let maxArrayLength = 1
      const processedValues = flatColumns.map((column) => {
      // Extract value using the column accessor
        let value: CellValue
        if (typeof column.accessor === 'string')
          value = getPropertyFromPath(rowData, column.accessor) as CellValue
        else
          value = column.accessor(rowData, rowIdx, 0)

        // Apply default value if needed
        if (value === undefined || value === null)
          value = column.default ?? null

        // Apply transform if specified
        if (column.transform) {
          if (typeof column.transform === 'string') {
            const transformer = this.schema.formatPresets[column.transform]
            if (typeof transformer === 'function')
              value = transformer(value)
          }
          else if (typeof column.transform === 'function') {
            value = column.transform(value, rowIdx)
          }
        }

        // Check if this is an array and update maxArrayLength
        if (Array.isArray(value))
          maxArrayLength = Math.max(maxArrayLength, value.length)

        return {
          value,
          format: this.getFormatForCell(column, rowData, rowIdx, 0),
          style: this.getStyleForCell(column, rowData, rowIdx, 0),
        }
      })

      // Create visual logical row group
      const isMultiRowGroup = maxArrayLength > 1

      // Find the center row index for non-array columns (to center content)
      const centerSubRowIdx = Math.floor((maxArrayLength - 1) / 2)

      // Create rows for each subrow
      for (let subRowIdx = 0; subRowIdx < maxArrayLength; subRowIdx++) {
        const isFirstSubrow = subRowIdx === 0
        const isLastSubrow = subRowIdx === maxArrayLength - 1
        const isCenterSubrow = subRowIdx === centerSubRowIdx

        // Prepare row values
        const rowValues = processedValues.map((processed) => {
          if (Array.isArray(processed.value)) {
          // For array values, get the appropriate element or empty string
            return subRowIdx < processed.value.length ? processed.value[subRowIdx] : null
          }
          else {
          // For non-array values, only include in center subrow for proper vertical centering
            return isCenterSubrow ? processed.value : null
          }
        })

        // Create the row with raw values
        const excelRow = this.worksheet.addRow(rowValues)

        // Apply styles and formatting to cells
        processedValues.forEach((processed, colIdx) => {
          const value = rowValues[colIdx]
          const isEmptyCell = value === null

          // Get base style
          let cellStyle = processed.style || {}
          let cellFormat = processed.format

          // For array values, update style and format for the specific subrow if needed
          if (Array.isArray(processed.value) && subRowIdx < processed.value.length) {
            const column = flatColumns[colIdx]
            cellStyle = this.getStyleForCell(column, rowData, rowIdx, subRowIdx) || {}
            cellFormat = this.getFormatForCell(column, rowData, rowIdx, subRowIdx)
          }

          // Set default alignment for all cells
          const alignmentStyle: Partial<Style> = {
            alignment: {
              horizontal: 'center',
              vertical: 'middle',
            },
          }

          if (isMultiRowGroup) {
          // We have a multi-row group
            if (!Array.isArray(processed.value)) {
            // Handle non-array columns in multi-row groups for "merged" appearance
              let borderStyle: Partial<Style> = {}

              if (isFirstSubrow && isLastSubrow) {
              // Single row case - normal thin borders
                borderStyle = {
                  border: {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' },
                  },
                }
              }
              else if (isFirstSubrow) {
              // First row in a merge group - normal top and sides, white bottom
                borderStyle = {
                  border: {
                    top: { style: 'medium' },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, // White bottom border
                    left: { style: 'thin' },
                    right: { style: 'thin' },
                  },
                }
              }
              else if (isLastSubrow) {
              // Last row in a merge group - normal bottom and sides, white top
                borderStyle = {
                  border: {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, // White top border
                    bottom: { style: 'medium' },
                    left: { style: 'thin' },
                    right: { style: 'thin' },
                  },
                }
              }
              else {
              // Middle row in a merge group - white top and bottom, normal sides
                borderStyle = {
                  border: {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, // White top border
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, // White bottom border
                    left: { style: 'thin' },
                    right: { style: 'thin' },
                  },
                }
              }

              // Preserve background color across all cells in the merge
              let backgroundStyle: Partial<Style> = {}
              if (cellStyle.fill) {
                backgroundStyle = {
                  fill: cellStyle.fill,
                }
              }

              // Combine styles with the right priority
              cellStyle = {
                ...cellStyle,
                ...alignmentStyle,
                ...backgroundStyle,
                ...borderStyle,
              }
            }
            else {
            // For array columns, use normal thin borders for everything
            // except outer boundaries of the logical row which are medium
              const borderStyle: Partial<Style> = {
                border: {
                  top: isFirstSubrow ? { style: 'medium' } : { style: 'thin' },
                  bottom: isLastSubrow ? { style: 'medium' } : { style: 'thin' },
                  left: { style: 'thin' },
                  right: { style: 'thin' },
                },
              }

              // Combine styles
              cellStyle = {
                ...cellStyle,
                ...alignmentStyle,
                ...borderStyle,
              }
            }
          }
          else {
          // For regular rows (no arrays/groups), just use thin borders everywhere
            const borderStyle: Partial<Style> = {
              border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' },
              },
            }

            // Combine styles
            cellStyle = {
              ...cellStyle,
              ...alignmentStyle,
              ...borderStyle,
            }
          }

          // Skip completely empty cells in merged regions
          if (isEmptyCell && !Array.isArray(processed.value) && !isCenterSubrow) {
          // For empty cells in a merged group, only apply style (no value)
            createStreamCell({
              row: excelRow,
              colIndex: colIdx + 1,
              value: '',
              style: cellStyle,
              format: cellFormat,
              bordered: false, // We're handling borders manually
            })
          }
          else {
          // Apply style and value to non-empty cells
            createStreamCell({
              row: excelRow,
              colIndex: colIdx + 1,
              value: value as BaseCellValue,
              style: cellStyle,
              format: cellFormat,
              bordered: false, // We're handling borders manually
            })
          }

          // Update column width calculation for non-empty cells
          if (!isEmptyCell) {
            const cellWidth = calculateColumnWidth(value)
            chunkColsWidth[colIdx] = Math.max(chunkColsWidth[colIdx], cellWidth)
          }
        })

        // Commit the row to free memory
        await excelRow.commit()
        this.rowIndex++
      }
    }

    this.columnWidths = this.columnWidths.map((_, i) => Math.max(this.columnWidths[i], chunkColsWidth[i]))
  }

  /**
   * Helper method to get the style for a cell
   */
  private getStyleForCell(
    column: Column<any, any, any, any, any>,
    rowData: T,
    rowIndex: number,
    subRowIndex: number,
  ): Partial<Style> | undefined {
    if (!column.cellStyle)
      return undefined

    if (typeof column.cellStyle === 'function')
      return column.cellStyle(rowData, rowIndex, subRowIndex)

    return column.cellStyle
  }

  /**
   * Helper method to get the format for a cell
   */
  private getFormatForCell(
    column: Column<any, any, any, any, any>,
    rowData: T,
    rowIndex: number,
    subRowIndex: number,
  ): string | undefined {
    if (!column.format)
      return undefined

    let format = column.format as any

    if (typeof format === 'function')
      format = format(rowData, rowIndex, subRowIndex)

    // Handle format presets
    if (typeof format === 'object' && 'preset' in format) {
      const presetName = format.preset as unknown as string
      const formatFn = this.schema.formatPresets[presetName]

      if (typeof formatFn === 'function')
        return formatFn(format.params)
      else if (typeof formatFn === 'string')
        return formatFn
    }
    else if (typeof format === 'string') {
      return format
    }

    return undefined
  }

  /**
   * Apply calculated column widths before committing
   * This method uses autoFormatColumns for consistent behavior with the non-streaming builder
   */
  private applyColumnWidths(): void {
    if (this.autoFormatOptions.disabled)
      return

    // Apply auto-formatting with constraints
    autoFormatColumns(this.worksheet, {
      minWidth: this.autoFormatOptions.minWidth,
      maxWidth: this.autoFormatOptions.maxWidth,
      headerWidthFactor: this.autoFormatOptions.headerWidthFactor,
      columnConstraints: this.columnConstraints,
      preCalculatedWidths: this.columnWidths,
    })
  }

  /**
   * Return the parent builder to continue the chain
   */
  public workbook(): Builder {
    return this.parentBuilder
  }

  /**
   * Commit this sheet and free its resources
   */
  public async commit(): Promise<void> {
    if (this.isCommitted)
      return

    try {
      // Apply column widths before committing
      this.applyColumnWidths()

      // Commit the worksheet
      await this.worksheet.commit()
      this.isCommitted = true
    }
    catch (error) {
      throw new Error(`Failed to commit worksheet: ${error}`)
    }
  }
}

/**
 * Main ExcelStreamBuilder class for streaming Excel generation
 */
export class ExcelStreamBuilder<UsedSheetKeys extends string = never> {
  private workbookWriter: stream.xlsx.WorkbookWriter
  private sheets: Map<string, StreamSheetBuilder<any, any, any>> = new Map()
  private options: {
    chunkMaxSize: number
    useStyles: boolean
    useSharedStrings: boolean
    bordered: boolean
  }

  private contextMap: Record<string, any> = {}

  private constructor(options: StreamBuilderOptions) {
    // Create workbook writer
    const workbookOptions = {
      filename: options.filePath,
      stream: options.stream,
      useStyles: options.useStyles ?? true,
      useSharedStrings: options.useSharedStrings ?? true,
      zip: options.zip,
    }
    this.workbookWriter = new stream.xlsx.WorkbookWriter(workbookOptions)

    this.options = {
      chunkMaxSize: options.chunkMaxSize ?? 5000,
      useStyles: options.useStyles ?? true,
      useSharedStrings: options.useSharedStrings ?? true,
      bordered: options.bordered ?? true,
    }
  }

  /**
   * Create a new ExcelStreamBuilder
   */
  public static create(options: StreamBuilderOptions): ExcelStreamBuilder {
    if (!options.filePath && !options.stream)
      throw new Error('Either filePath or stream must be provided')

    return new ExcelStreamBuilder(options)
  }

  /**
   * Add a new sheet to the workbook with type-safe selection and context
   */
  public sheet<
    Key extends string,
    Schema extends ExcelSchema<any, any, string, any>,
    T extends SchemaData<Schema> = SchemaData<Schema>,
    ColKeys extends SchemaColumnKeys<Schema> = SchemaColumnKeys<Schema>,
    SelectColsMap extends { [key in ColKeys]?: boolean } | never = never,
    SelectedCols extends string = ExtractSelectedColumns<ColKeys, SelectColsMap>,
    ContextMap extends { [key: string]: any } = ExtractContextMap<Schema>,
    SelectedContextMap extends ExtractSelectedContext<ContextMap, SelectedCols> = ExtractSelectedContext<ContextMap, SelectedCols>,
  >(
    key: Not<Key, UsedSheetKeys>,
    options: {
      schema: Schema
      title?: string
      titleStyle?: Partial<Style> | ((data: T[]) => Partial<Style>)
      autoFormat?: AutoFormatOptions
      select?: SelectColsMap
    } & (keyof SelectedContextMap extends never ? { context?: {} } : { context: Prettify<SelectedContextMap> }),
  ): StreamSheetBuilder<T, Schema, ExcelStreamBuilder<UsedSheetKeys | Key>> {
    if (this.sheets.has(key))
      throw new Error(`Sheet with key '${key}' already exists`)

    // Store context if provided
    if (options.context)
      this.contextMap = { ...this.contextMap, ...options.context }

    // Create worksheet
    const worksheet = this.workbookWriter.addWorksheet(key, {
      properties: {
        defaultRowHeight: 20,
      },
    })

    // Create and store sheet builder
    const sheetBuilder = new StreamSheetBuilder<T, Schema, ExcelStreamBuilder<UsedSheetKeys | Key>>(
      this as any,
      this.workbookWriter,
      worksheet,
      {
        schema: options.schema,
        title: options.title,
        titleStyle: options.titleStyle,
        chunkMaxSize: this.options.chunkMaxSize,
        bordered: this.options.bordered,
        autoFormat: options.autoFormat,
        select: options.select as Record<string, boolean>, // Type cast necessary due to complex generics
      },
    )

    this.sheets.set(key, sheetBuilder)

    return sheetBuilder
  }

  /**
   * Get context map
   */
  public getContext(): Record<string, any> {
    return this.contextMap
  }

  /**
   * Save the workbook and commit all resources
   */
  public async save(): Promise<void> {
    try {
      // Commit all uncommitted sheets
      for (const [_, sheet] of this.sheets)
        await sheet.commit()

      // Commit the workbook
      await this.workbookWriter.commit()

      // Clear references to aid garbage collection
      this.sheets.clear()
      this.contextMap = {}
    }
    catch (error) {
      throw new Error(`Failed to save workbook: ${error}`)
    }
  }
}
