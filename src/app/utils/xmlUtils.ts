// src/utils/xmlUtils.ts

/**
 * XML utility functions for parsing XML/KML responses
 */

/**
 * Parse XML string to JavaScript object
 * @param xmlString XML string to parse
 * @returns Parsed object
 */
export function parseXML(xmlString: string): any {
  // This is a simplified implementation
  // In a real app, you'd use a library like xml2js or fast-xml-parser
  
  // For the purposes of this implementation, we'll create a mock parser
  // that extracts the required information from the KML/XML response
  
  // Create a DOMParser to parse the XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  // Extract placemarks
  const placemarks = xmlDoc.getElementsByTagName("Placemark");
  const result: any[] = [];
  
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    
    // Extract basic data
    const name = getElementTextContent(placemark, "name");
    const description = getElementTextContent(placemark, "description");
    const coordinates = extractCoordinates(placemark);
    
    // Extract extended data
    const extendedData = extractExtendedData(placemark);
    
    result.push({
      name,
      description,
      coordinates,
      ExtendedData: {
        Data: extendedData
      }
    });
  }
  
  return {
    Document: {
      Placemark: result
    }
  };
}

/**
 * Extract text content from an XML element
 */
function getElementTextContent(element: Element, tagName: string): string {
  const el = element.getElementsByTagName(tagName)[0];
  return el ? el.textContent || "" : "";
}

/**
 * Extract coordinates from placemark
 */
function extractCoordinates(placemark: Element): [number, number] {
  const point = placemark.getElementsByTagName("Point")[0];
  if (!point) return [0, 0];
  
  const coordsElement = point.getElementsByTagName("coordinates")[0];
  if (!coordsElement || !coordsElement.textContent) return [0, 0];
  
  const coordsText = coordsElement.textContent.trim();
  const [lon, lat] = coordsText.split(",").map(parseFloat);
  
  return [lon, lat];
}

/**
 * Extract extended data from placemark
 */
function extractExtendedData(placemark: Element): any[] {
  const result: any[] = [];
  const extendedData = placemark.getElementsByTagName("ExtendedData")[0];
  if (!extendedData) return result;
  
  const dataElements = extendedData.getElementsByTagName("Data");
  for (let i = 0; i < dataElements.length; i++) {
    const data = dataElements[i];
    const name = data.getAttribute("name") || "";
    const valueElement = data.getElementsByTagName("value")[0];
    const value = valueElement ? valueElement.textContent || "" : "";
    
    result.push({
      name,
      value
    });
  }
  
  return result;
}

/**
 * Helper function to extract a value from extended data by name
 */
export function getExtendedDataValue(placemark: any, dataName: string): string {
  if (!placemark.ExtendedData || !placemark.ExtendedData.Data) return "";
  
  const data = placemark.ExtendedData.Data.find((d: any) => d.name === dataName);
  return data ? data.value : "";
}