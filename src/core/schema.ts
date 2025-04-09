// core/schema.ts
/* eslint-disable ts/ban-types */
import type { BaseCellValue, Column, ColumnGroup, ExcelSchema, FormatterPreset, FormattersMap, GenericObject, NestedPaths, Not, TransformersMap } from '../types'

export class ExcelSchemaBuilder<
  T extends GenericObject,
  CellKeyPaths extends string,
  UsedKeys extends string = never,
  TransformMap extends TransformersMap = {},
  FormatMap extends FormattersMap = {},
  ContextMap extends { [key: string]: any } = {},
> {
  private columns: Array<Column<T, CellKeyPaths | ((data: T, rowIndex?: number, subRowIndex?: number) => any), string, TransformMap, FormatMap> | ColumnGroup<T, string, CellKeyPaths, string, TransformMap, FormatMap, any>> = []
  private transformers: TransformMap = {} as TransformMap
  private formatters: FormatMap = {} as FormatMap

  public static create<T extends GenericObject, KeyPath extends string = NestedPaths<T>>(): ExcelSchemaBuilder<T, KeyPath> {
    return new ExcelSchemaBuilder<T, KeyPath>()
  }

  public withTransformers<Transformers extends TransformersMap>(transformers: Transformers): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers, FormatMap, ContextMap> {
    this.transformers = transformers as TransformMap & Transformers
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers, FormatMap, ContextMap>
  }

  withFormatters<
    Formatters extends FormattersMap,
  >(formatters: Formatters,
  ): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap, FormatMap & Formatters, ContextMap> {
    this.formatters = formatters as FormatMap & Formatters
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap, FormatMap & Formatters, ContextMap>
  }

  public column<
    K extends string,
    AccessorValue extends CellKeyPaths | ((data: T, rowIndex?: number, subRowIndex?: number) => any),
    Preset extends FormatterPreset<FormatMap>[keyof FormatMap],
  >(
    columnKey: Not<K, UsedKeys>,
    column: Omit<Column<T, AccessorValue, K, TransformMap, FormatMap, Preset>, 'columnKey' | 'type'>,
  ): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys | K, TransformMap, FormatMap, ContextMap> {
    if (this.columns.some(c => c.columnKey === columnKey))
      throw new Error(`Column with key '${columnKey}' already exists.`)

    this.columns.push({ type: 'column', columnKey, ...column } as any)
    return this
  }

  public group<
    K extends `group:${string}`,
    Context,
  >(
    key: Not<K, UsedKeys>,
    handler: (builder: ExcelSchemaBuilder<T, CellKeyPaths, never, TransformMap, FormatMap>, context: Context) => void,
  ): ExcelSchemaBuilder<
    T,
    CellKeyPaths,
    UsedKeys | K,
    TransformMap,
    FormatMap,
    ContextMap & { [key in K]: Context }
  > {
    if (this.columns.some(c => c.columnKey === key))
      throw new Error(`Column with key '${key}' already exists.`)

    const builder = () => ExcelSchemaBuilder.create<T, CellKeyPaths>()
      .withTransformers(this.transformers)
      .withFormatters(this.formatters)

    this.columns.push({
      type: 'group',
      columnKey: key,
      builder,
      handler,
    } as any)
    return this as any
  }

  public build() {
    const columns = this.columns.map(column => column.type === 'column'
      ? ({
          ...column,
          transform: typeof column.transform === 'string'
            ? this.transformers[column.transform]
            : column.transform,
        })
      : column)

    return {
      columns,
      formatPresets: this.formatters as FormattersMap,
    } as ExcelSchema<
      T,
      CellKeyPaths,
      UsedKeys,
      ContextMap
    >
  }
}
