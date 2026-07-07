import { xmlDocument, xmlElement, xmlSelfClosing } from "./xml";

export const FEATURE_PROPERTY_BAG_PATH = "xl/featurePropertyBag/featurePropertyBag.xml";
export const FEATURE_PROPERTY_BAG_CONTENT_TYPE = "application/vnd.ms-excel.featurepropertybag+xml";
export const FEATURE_PROPERTY_BAG_RELATIONSHIP_TYPE =
  "http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag";

const FEATURE_PROPERTY_BAG_XMLNS =
  "http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag";

export function writeFeaturePropertyBagXml() {
  return xmlDocument(
    "FeaturePropertyBags",
    {
      xmlns: FEATURE_PROPERTY_BAG_XMLNS,
    },
    [
      xmlSelfClosing("bag", { type: "Checkbox" }),
      xmlElement("bag", { type: "XFControls" }, xmlElement("bagId", { k: "CellControl" }, "0")),
      xmlElement("bag", { type: "XFComplement" }, xmlElement("bagId", { k: "XFControls" }, "1")),
      xmlElement(
        "bag",
        { type: "XFComplements", extRef: "XFComplementsMapperExtRef" },
        xmlElement("a", { k: "MappedFeaturePropertyBags" }, xmlElement("bagId", undefined, "2")),
      ),
    ],
  );
}
