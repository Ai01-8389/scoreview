declare module 'xlsx' {
  export function read(data: any, opts: any): any;
  export function writeFile(workbook: any, filename: string): void;
  export const utils: {
    sheet_to_json<T = any>(sheet: any, opts?: any): T[];
    json_to_sheet(data: any[], opts?: any): any;
    book_new(): any;
    book_append_sheet(wb: any, ws: any, name: string): void;
  };
}

declare module 'tesseract.js' {
  export function recognize(
    image: any,
    languages: string,
    options?: any
  ): Promise<{ data: { text: string; confidence: number } }>;
}
