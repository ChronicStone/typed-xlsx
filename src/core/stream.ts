import type { Writable } from 'node:stream'
import type { Style, Worksheet } from 'exceljs'
import { stream } from 'exceljs'
import type {
  BaseCellValue,
  CellValue,
  Column,
  ExcelSchema,
  FormatterPreset,
  GenericObject,
  Not,
  SchemaData,
} from '../types'

import {
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
  private mergedCellsBuffer: Array<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  }> = []

  private bordered: boolean

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
      const columnsCount = this.flattenColumns(this.schema.columns).length
      if (columnsCount > 1)
        this.worksheet.mergeCells(1, 1, 1, columnsCount)

      // Set title row height
      titleRow.height = 30

      // Commit the title row
      await titleRow.commit()
      this.rowIndex++
    }

    // Process column headers
    const flatColumns = this.flattenColumns(this.schema.columns)
    const headerRow = this.worksheet.addRow(
      flatColumns.map(column => column.label ?? formatKey(column.columnKey)),
    )

    // Apply styles to header cells using adapted createStreamCell
    flatColumns.forEach((column, index) => {
      const headerStyle = getColumnHeaderStyle({
        bordered: this.bordered,
        customStyle: column.headerStyle,
      })

      createStreamCell({
        row: headerRow,
        colIndex: index + 1,
        value: column.label ?? formatKey(column.columnKey),
        style: headerStyle,
        bordered: this.bordered,
      })
    })

    // Commit the header row
    await headerRow.commit()
    this.rowIndex++
    this.firstRow = this.rowIndex
    this.headerWritten = true
  }

  /**
   * Process a single chunk of data
   */
  private async processChunk(chunk: T[]): Promise<void> {
    if (chunk.length === 0)
      return

    // Flatten columns (expand column groups)
    const flatColumns = this.flattenColumns(this.schema.columns)

    // Process each row in the chunk
    for (let rowIdx = 0; rowIdx < chunk.length; rowIdx++) {
      const rowData = chunk[rowIdx]

      // Extract cell values first (needed for creating the row)
      const rowValues = flatColumns.map((column) => {
        // Extract value using the column key
        let value: CellValue
        if (typeof column.key === 'string')
          value = getPropertyFromPath(rowData, column.key) as CellValue
        else
          value = column.key(rowData)

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

        return value
      })

      // Create the row with raw values
      const excelRow = this.worksheet.addRow(rowValues)

      // Now apply styles and formatting to each cell
      flatColumns.forEach((column, colIdx) => {
        // Determine cell style
        let cellStyle: Partial<Style> | undefined
        if (column.cellStyle) {
          if (typeof column.cellStyle === 'function')
            cellStyle = column.cellStyle(rowData, rowIdx, 0)
          else
            cellStyle = column.cellStyle
        }

        // Get format
        let formatString: string | undefined
        if (column.format) {
          let format: string | FormatterPreset<any> | undefined = column.format as any

          if (typeof format === 'function')
            format = (format as any)(rowData, rowIdx, 0)

          // Handle format presets
          if (typeof format === 'object' && 'preset' in format) {
            const presetName = format.preset as unknown as string
            const formatFn = this.schema.formatPresets[presetName]

            if (typeof formatFn === 'function')
              formatString = formatFn(format.params)

            else if (typeof formatFn === 'string')
              formatString = formatFn
          }
          else if (typeof format === 'string') {
            formatString = format
          }
        }

        // Apply style to cell
        createStreamCell({
          row: excelRow,
          colIndex: colIdx + 1,
          value: rowValues[colIdx] as BaseCellValue,
          style: cellStyle,
          format: formatString,
          bordered: this.bordered,
        })
      })

      // Commit the row to free memory
      await excelRow.commit()
      this.rowIndex++
    }
  }

  /**
   * Flatten schema columns, expanding column groups
   */
  private flattenColumns(columns: Schema['columns']): Column<any, any, any, any, any>[] {
    return columns.reduce((acc: Column<any, any, any, any, any>[], column) => {
      if (column.type === 'column') {
        acc.push(column as Column<any, any, any, any, any>)
      }
      else if (column.type === 'group') {
        const builder = column.builder()
        column.handler(builder, this.parentBuilder.getContext()[column.columnKey])
        const { columns: groupColumns } = builder.build()
        acc.push(...this.flattenColumns(groupColumns as any))
      }
      return acc
    }, [])
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
      // Process any pending merged cells
      for (const mergedCell of this.mergedCellsBuffer) {
        this.worksheet.mergeCells(
          mergedCell.startRow,
          mergedCell.startCol,
          mergedCell.endRow,
          mergedCell.endCol,
        )
      }
      this.mergedCellsBuffer = []

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
   * Add a new sheet to the workbook
   */
  public sheet<Key extends string, Schema extends ExcelSchema<any, any, string>, T extends SchemaData<Schema> = SchemaData<Schema>>(
    key: Not<Key, UsedSheetKeys>,
    options: {
      schema: Schema
      title?: string
      titleStyle?: Partial<Style> | ((data: T[]) => Partial<Style>)
      context?: Record<string, any>
    },
  ): StreamSheetBuilder<T, Schema, ExcelStreamBuilder<UsedSheetKeys | Key>> {
    if (this.sheets.has(key))
      throw new Error(`Sheet with key '${key}' already exists`)

    // Store context if provided
    if (options.context)
      this.contextMap = { ...this.contextMap, ...options.context }

    // Create worksheet
    const worksheet = this.workbookWriter.addWorksheet(key)

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
