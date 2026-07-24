import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const MAX_UPLOAD_BYTES: number;
export declare const uploadFileInputSchema: {
    filePath: z.ZodOptional<z.ZodString>;
    base64: z.ZodOptional<z.ZodString>;
    filename: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodOptional<z.ZodString>;
};
interface UploadFileArgs {
    filePath: string | undefined;
    base64: string | undefined;
    filename: string | undefined;
    mimeType: string | undefined;
}
export declare function makeUploadFileHandler(ctx: ToolContext): (args: UploadFileArgs) => Promise<CallToolResult>;
export declare function registerUploadFile(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=upload-file.d.ts.map